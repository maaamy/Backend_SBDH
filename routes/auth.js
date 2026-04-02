import express from "express";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { genToken, emailAlreadyUsed, verifyGoogleToken, findUser, siretAlreadyUsedWithAnotherEmail, findUserById } from "../helpers/authHelpers.js";
import authMiddleware from "../middleware/authMiddleware.js";

dotenv.config();

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// connexion client
router.post("/connexion-client", async (req, res) => {
    try {
        const { email, mdp } = req.body;
        
        const user = await findUser({ email, type: "client" });
       
        if (!user || !bcrypt.compareSync(mdp, user.mdp_h))
            return res.status(401).json({ error: "Email ou mot de passe incorrect" });
       
        const token = genToken(user.user_id, "client");
        res.cookie('token', token, {
            httpOnly: true,
            secure: false,   
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60 * 1000,
        });
       
        res.json({
            user: { user_id: user.user_id, email, type: "client"}
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// connexion entreprise
router.post("/connexion-entreprise", async (req, res) => {
    try {
        const { email, siret, mdp } = req.body;

        const user = await findUser({ email, type: "entreprise", siret });

        if (!user || !bcrypt.compareSync(mdp, user.mdp_h))
            return res.status(401).json({ error: "Email ou mot de passe incorrect" });

        const token = genToken(user.user_id, "entreprise");
        
        res.cookie('token', token, {
            httpOnly: true,
            secure: false,   
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60 * 1000,
        });

        res.json({
            user: { user_id: user.user_id, email, type: "entreprise"}
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// inscription client
router.post("/inscription-client", async (req, res) => {
    try {
        const {
        email, mdp, nom, prenom,
        adresse1, adresse2, ville, codePostal, pays,
        jour, mois, annee,
        } = req.body;

        if (await emailAlreadyUsed(email))
            return res.status(400).json({ error: "Email déjà utilisé" });

        const mdp_h = bcrypt.hashSync(mdp, 10);

        const { data: newUser, error: userError } = await supabase
            .from("Utilisateurs")
            .insert({ email, mdp_h, type: "client", provider: "local" })
            .select("user_id")
            .single();

        if (userError) return res.status(500).json({ error: userError.message });
       
        const { error: profilError } = await supabase.from("Client").insert({
            login_id: newUser.user_id,
            nom, prenom, email,
            adresse: adresse1, adresse2, ville,
            code_postal: codePostal, pays,
            date_naissance: `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`,
            date_inscription: new Date().toISOString(),
        });
       
        if (profilError) return res.status(500).json({ error: profilError.message });
       
        const token = genToken(newUser.user_id, "client");
        
        res.cookie('token', token, {
            httpOnly: true,
            secure: false,   
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60 * 1000,
        });

        res.json({
            user: { user_id: newUser.user_id, email, type: "client" },
        });
       
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// inscription entreprise
router.post("/inscription-entreprise", async (req, res) => {
    try {
        const {
            nomEntreprise, siret, email, mdp,
            adresse1, adresse2, ville, codePostal, pays,
        } = req.body;

        if (await emailAlreadyUsed(email))
            return res.status(400).json({ error: "Email déjà utilisé" });

        if (await siretAlreadyUsedWithAnotherEmail(siret, email))
            return res.status(400).json({ error: "Inscription invalide" });

        const mdp_h = bcrypt.hashSync(mdp, 10);

        const { data: newUser, error: userError } = await supabase
            .from("Utilisateurs")
            .insert({ email, mdp_h, siret, type: "entreprise", provider: "local" })
            .select("user_id")
            .single();

        if (userError) return res.status(500).json({ error: userError.message });

        const { error: profilError } = await supabase.from("Entreprise").insert({
            login_id: newUser.user_id,
            nom: nomEntreprise, siret, email,
            adresse: adresse1, adresse2, ville,
            code_postal: codePostal, pays,
            date_inscription: new Date().toISOString(),
        });

        if (profilError) return res.status(500).json({ error: profilError.message });

        const token = genToken(newUser.user_id, "entreprise");
        
        res.cookie('token', token, {
            httpOnly: true,
            secure: false,   
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60 * 1000,
        });

        res.json({
            user: { user_id: newUser.user_id, email , type: "entreprise"},
        });

    } catch (err) {
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// connexion avec google
const googleLoginOrRegister = async ({ email, nom, type, siret = null, profilData = {} }) => {

    const isEmailUsed = await emailAlreadyUsed(email);
  
    const existantUser = await findUser(
        siret ? { email, type, siret } : { email, type }
    );

    if (isEmailUsed && existantUser) return existantUser;

    if (isEmailUsed && !existantUser) throw new Error("Compte déjà utilisé");

    const { data: newUser, error } = await supabase
        .from("Utilisateurs")
        .insert({ email, mdp_h: null, type, siret, provider: "google" })
        .select("user_id")
        .single();

    if (error) throw new Error(error.message);

    const table = type === "client" ? "Client" : "Entreprise";
    await supabase.from(table).insert({
        login_id: newUser.user_id,
        nom,
        email,
        ...(siret && { siret }),
        ...profilData,
        date_inscription: new Date().toISOString(),
    });

    return newUser;
};

// connexion client avec google
router.post("/connexion-client/google", async (req, res) => {
    try {
        const { token } = req.body;
        const payload = await verifyGoogleToken(token);

        const user = await googleLoginOrRegister({
            email: payload.email,
            nom: payload.name,
            type: "client",
            profilData: { prenom: "" },
        });

        const jwtToken =  genToken(user.user_id, "client");
        
        res.cookie('token', jwtToken, {
            httpOnly: true,
            secure: false,   
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60 * 1000,
        });

        res.json({
            user: { user_id: user.user_id, email: payload.email, type: "client" },
        });
    } catch (err) {
        res.status(401).json({ error: "Échec de la connexion avec Google" });
    }
});


// connexion entreprise avec google
router.post("/connexion-entreprise/google", async (req, res) => {
    try {
        const { token, siret } = req.body;

        if (!siret)
            return res.status(400).json({ error: "SIRET requis pour une entreprise" });

        const payload = await verifyGoogleToken(token);
        if( await siretAlreadyUsedWithAnotherEmail(siret, payload.email))
            return res.status(400).json({ error: "Connexion invalide" });

        const user = await googleLoginOrRegister({
            email: payload.email,
            nom: payload.name,
            type: "entreprise",
            siret,
        });

        const jwtToken =  genToken(user.user_id, "entreprise");
        
        res.cookie('token', jwtToken, {
            httpOnly: true,
            secure: false,   
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60 * 1000,
        });

        res.json({
            user: { user_id: user.user_id, email: payload.email, type:"entreprise" },
        });
    } catch (err) {
        res.status(401).json({ error: "Échec de la connexion avec Google" });
    }
});

// verification token
router.get('/verify', authMiddleware, async(req, res) => {
    res.set('Cache-Control', 'no-store');
    const user = await findUserById(req.user.user_id);
    res.json({ user });
    });

    router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: false,  
        sameSite: 'Strict',
    });
    res.json({ success: true });
});


export default router;