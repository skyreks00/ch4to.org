# Ch4to

Application de messagerie en temps réel avec appels vidéo, réalisée dans le cadre de mon TFE.

Le serveur tourne sous Node.js avec Express. Les messages passent par Socket.io et les appels vidéo par WebRTC, directement entre les deux navigateurs. Les comptes, les amis et les groupes sont stockés dans MySQL (via Prisma), l'historique des messages dans MongoDB.

## Fonctionnalités

- Inscription et connexion : mots de passe hachés avec bcrypt, session côté serveur et jeton JWT
- Messages privés et discussions de groupe, avec indicateur de saisie, accusés de lecture et statut en ligne
- Amis : recherche d'utilisateurs, demandes d'ami (envoi, acceptation, refus), suppression
- Groupes : création, ajout et retrait de membres, avatar de groupe ; le créateur qui quitte un groupe en désigne un nouveau
- Envoi d'images et de fichiers (50 Mo maximum par fichier)
- Photo de profil
- Appels vidéo en tête-à-tête (WebRTC, serveurs STUN publics)
- Interface adaptée au mobile

Si MongoDB n'est pas joignable au démarrage, le serveur se lance quand même, mais les messages ne sont pas conservés.

## Stack

| Partie  | Technologies |
| ------- | ------------ |
| Serveur | Node.js, Express, Socket.io, express-session, jsonwebtoken, Multer |
| Données | MySQL + Prisma (utilisateurs, amis, groupes), MongoDB + Mongoose (messages) |
| Client  | HTML, CSS et JavaScript sans framework, WebRTC |

## Installation

Il faut Node.js 18 ou plus récent, un serveur MySQL et un serveur MongoDB. Pour une installation pas à pas sous Windows, voir [INSTALLATION.md](INSTALLATION.md).

```bash
git clone https://github.com/skyreks00/ch4to.org.git
cd ch4to.org
npm install
```

Créer un fichier `.env` à la racine :

```env
DATABASE_URL="mysql://utilisateur:motdepasse@localhost:3306/ch4to"
MONGODB_URI="mongodb://localhost:27017/ch4to"
JWT_SECRET="une_longue_chaine_aleatoire"
SESSION_SECRET="une_autre_chaine_aleatoire"
PORT=3000
```

Créer les tables MySQL puis démarrer le serveur :

```bash
npm run prisma:generate
npm run prisma:push
npm start
```

L'application est alors disponible sur http://localhost:3000.

Le cookie de session est marqué `secure` : en dehors de `localhost`, l'application doit être servie en HTTPS. C'est ce que fait `start.bat` sous Windows : il installe les dépendances si besoin, lance le serveur puis un tunnel Cloudflare (`cloudflared tunnel run mon-tunnel`, à configurer au préalable).

## Scripts

| Commande | Rôle |
| -------- | ---- |
| `npm start` | Lance le serveur |
| `npm run dev` | Lance le serveur avec nodemon (redémarrage à chaque modification) |
| `npm run prisma:generate` | Génère le client Prisma |
| `npm run prisma:push` | Applique `prisma/schema.prisma` à la base MySQL |
| `node show-db-structure.js` | Affiche la structure et le contenu des deux bases (`show-db.bat` sous Windows) |

## Organisation du code

```text
backend/
  index.js            serveur Express et événements Socket.io (messages, présence, signalisation des appels)
  routes/             API REST : auth.js, friends.js, groups.js
  models/Message.js   schéma Mongoose des messages
  utils/db.js         connexions Prisma et MongoDB
frontend/             pages HTML, CSS et JavaScript servis en statique
prisma/schema.prisma  schéma de la base MySQL
```

| Préfixe API | Rôle |
| ----------- | ---- |
| `/api/auth` | Inscription, connexion, déconnexion, vérification de session, avatar |
| `/api/friends` | Recherche d'utilisateurs, demandes d'ami, liste d'amis |
| `/api/groups` | Groupes, membres, avatar de groupe |
| `/api/messages` | Historique d'une conversation, envoi de fichiers |

Les fichiers envoyés sont enregistrés dans `backend/uploads/`, qui n'est pas versionné.

## Auteur

sunshine ([@skyreks00](https://github.com/skyreks00)). Projet sous licence ISC.
