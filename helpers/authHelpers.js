import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";


dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const genToken = (user_id, type, expiresIn = "2h") =>
    jwt.sign({ user_id, type }, SECRET_KEY, { expiresIn });

export const emailAlreadyUsed = async (email) => {
    const { count } = await supabase
        .from("Utilisateurs")
        .select("*", { count: "exact", head: true })
        .eq("email", email);
    return count > 0;
};

export const siretAlreadyUsedWithAnotherEmail = async (siret, email) => {
    const user = await supabase
        .from("Utilisateurs")
        .select("*")
        .eq("siret", siret)
    if( user ){
        return user.email !== email;
    }
    return false;
};

export const verifyGoogleToken = async (token) => {
    const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
};

export const findUser = async ({email, type, siret=null}) => {
    const selectQuery = type === "client" 
        ? "user_id, mdp_h, type, Client(nom)"
        : "user_id, mdp_h, type, Entreprise(nom)";

    const query = supabase
        .from("Utilisateurs")
        .select(selectQuery)
        .eq("email", email)
        .eq("type", type)
        [siret === null ? "is" : "eq"]("siret", siret)
        .limit(1);


    const { data, error } = await query;
    if (error) throw new Error(error.message);
        return data?.[0] || null;
};

export const findUserById = async (user_id) => {
    const { data, error } = await supabase
        .from("Utilisateurs")
        .select("user_id, email, type, Client(nom), Entreprise(nom)")
        .eq("user_id", user_id)
        .limit(1);

    if (error) throw new Error(error.message);
    
    const user = data?.[0] || null;
    if (!user) return null;

    return {
        user_id: user.user_id,
        email: user.email,
        type: user.type,
        nom: user.Client?.[0]?.nom || user.Entreprise?.[0]?.nom || null
    };
};

