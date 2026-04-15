# E-Commerce Platform & Smart Business Decision Hub (SBDH)

Le backend de SBDH est une API REST construite avec Express.js, conçue pour alimenter la plateforme e-commerce intelligente.
Il gère l’authentification, les données utilisateurs, les produits, ainsi que les services d’analyse et de recommandation.

## Installation

```bash
#Cloner le repo
git clone git@github.com:maamy/Backend_SBDH.git
cd Backend_SBDH

#Installer les dépendances
npm install

# Lancer en dev
node server.js
```

Le serveur sera accessible sur :
```bash
http://localhost:3000
```


## Variables d’environnement

Créer un fichier .env à la racine du projet :

```
PORT=3000

# Base de données
SUPABASE_URL=database_url
SUPABASE_SERVICE_ROLE_KEY=database_role_key

# Authentification
JWT_SECRET=jwt_secret

# Google OAuth
GOOGLE_CLIENT_ID=google_client_id
```
