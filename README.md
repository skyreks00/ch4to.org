# 💬 ChatApp WebRTC

Application de chat en temps réel avec appels vidéo/audio intégrant WebRTC, Socket.io et une architecture full-stack moderne.

## ✨ Fonctionnalités

- 🔐 **Authentification sécurisée** - Inscription/Connexion avec JWT et bcrypt
- 💬 **Chat en temps réel** - Messages instantanés avec Socket.io
- 👥 **Système d'amis** - Envoi/acceptation de demandes d'ami
- 🎥 **Appels audio/vidéo** - Communication WebRTC peer-to-peer
- 📱 **Groupes de discussion** - Création et gestion de groupes
- 📎 **Partage de fichiers** - Envoi d'images, documents et médias
- 🖼️ **Avatars personnalisables** - Upload et gestion de photos de profil
- 📱 **Design responsive** - Interface adaptée mobile et desktop

## 🛠️ Technologies

### Backend
- **Node.js** & **Express** - Serveur et API REST
- **Socket.io** - Communication temps réel bidirectionnelle
- **Prisma** - ORM pour MySQL
- **MongoDB** - Stockage des messages
- **JWT** - Authentification par tokens
- **Multer** - Gestion des uploads de fichiers

### Frontend
- **HTML5/CSS3** - Interface utilisateur
- **JavaScript Vanilla** - Logique client
- **WebRTC** - Appels audio/vidéo P2P
- **Socket.io Client** - Communication temps réel

### Base de données
- **MySQL** - Données utilisateurs, amis, groupes
- **MongoDB** - Historique des messages

## 📦 Installation

### Prérequis
- Node.js (v14 ou supérieur)
- MySQL
- MongoDB

### Étapes

1. **Cloner le repository**
```bash
git clone https://github.com/skyreks00/ch4to.org.git
cd ch4to.org
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer les variables d'environnement**

Créez un fichier `.env` à la racine du projet :

```env
# Base de données MySQL
DATABASE_URL="mysql://user:password@localhost:3306/chatapp"

# MongoDB
MONGODB_URI="mongodb://localhost:27017/chatapp"

# JWT Secret
JWT_SECRET="votre_secret_jwt_securise"

# Session Secret
SESSION_SECRET="votre_secret_session_securise"

# Port serveur
PORT=3000
```

4. **Initialiser la base de données**
```bash
npm run prisma:generate
npm run prisma:push
```

5. **Lancer l'application**
```bash
npm start
```

L'application sera accessible sur `http://localhost:3000`

## 🚀 Utilisation

### Démarrage en développement
```bash
npm run dev
```

### Commandes Prisma
```bash
# Générer le client Prisma
npm run prisma:generate

# Pousser le schéma vers la base de données
npm run prisma:push
```

## 📁 Structure du projet

```
.
├── backend/
│   ├── index.js              # Point d'entrée serveur
│   ├── models/               # Modèles MongoDB
│   │   └── Message.js
│   ├── routes/               # Routes API
│   │   ├── auth.js           # Authentification
│   │   ├── friends.js        # Gestion des amis
│   │   └── groups.js         # Gestion des groupes
│   └── utils/
│       └── db.js             # Configuration bases de données
├── frontend/
│   ├── index.html            # Page principale
│   ├── css/                  # Styles
│   │   ├── style.css
│   │   └── mobile.css
│   └── js/                   # Scripts client
│       ├── app.js
│       ├── auth.js
│       └── group-management.js
├── prisma/
│   └── schema.prisma         # Schéma de la base MySQL
├── .env                      # Variables d'environnement
├── .gitignore
└── package.json
```

## 🔒 Sécurité

- Mots de passe hashés avec **bcrypt**
- Tokens JWT pour l'authentification
- Sessions sécurisées avec express-session
- Protection CORS configurée
- Validation des inputs côté serveur
- Fichiers sensibles exclus (.env, uploads/)

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche (`git checkout -b feature/amelioration`)
3. Commit vos changements (`git commit -m 'Ajout d'une fonctionnalité'`)
4. Push vers la branche (`git push origin feature/amelioration`)
5. Ouvrir une Pull Request

## 📝 Licence

ISC

## 👤 Auteur

**sunshine** - [skyreks00](https://github.com/skyreks00)

---

⭐ N'oubliez pas de mettre une étoile si ce projet vous a été utile !
