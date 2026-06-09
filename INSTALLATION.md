# Guide d'Installation - Étape par Étape

## 📋 Prérequis

Ce guide vous accompagne pas à pas dans l'installation complète de l'application de messagerie.

**Durée estimée**: 15-20 minutes  
**Niveau**: Débutant

---

## ÉTAPE 1: Installation de Node.js

### Fichier à installer
- Chercher dans le ZIP: `node-v20.x.x-x64.msi` (ou similaire)

### Installation
1. Double-cliquer sur l'installeur Node.js
2. Cliquer sur **Next** (Suivant)
3. Accepter les conditions d'utilisation
4. Garder le chemin d'installation par défaut
5. ✅ **Important**: Cocher "Automatically install the necessary tools"
6. Cliquer sur **Install**
7. Attendre la fin de l'installation
8. Cliquer sur **Finish**

### Vérification
1. Ouvrir une **nouvelle** invite de commandes (cmd) ou PowerShell
2. Taper: `node --version`
   - Vous devriez voir: `v20.x.x`
3. Taper: `npm --version`
   - Vous devriez voir: `10.x.x`

✅ **Si les versions s'affichent, Node.js est correctement installé !**

---

## ÉTAPE 2: Installation de MongoDB

### Fichier à installer
- Chercher dans le ZIP: `mongodb-windows-x86_64-7.0.x.msi` (ou similaire)

### Installation
1. Double-cliquer sur l'installeur MongoDB
2. Cliquer sur **Next**
3. Accepter les conditions d'utilisation
4. Choisir **Complete** (installation complète)
5. ✅ **Important**: Cocher "Install MongoDB as a Service"
   - Service Name: `MongoDB`
   - Laisser les autres options par défaut
6. ✅ **Important**: Cocher "Install MongoDB Compass" (interface graphique)
7. Cliquer sur **Install**
8. Attendre la fin de l'installation (peut prendre 5-10 minutes)
9. Cliquer sur **Finish**

### Vérification
1. Ouvrir les **Services Windows**:
   - Appuyer sur `Windows + R`
   - Taper: `services.msc`
   - Appuyer sur Entrée
2. Chercher **MongoDB** dans la liste
3. Vérifier que le statut est **Démarré**

✅ **Si MongoDB est démarré, l'installation est réussie !**

---

## ÉTAPE 3: Extraction du Projet

### Décompression
1. Localiser le fichier `project-complet.zip`
2. Clic droit → **Extraire tout...**
3. Choisir un emplacement simple, par exemple:
   - `C:\projet-chat\`
   - `C:\Users\VotreNom\Documents\chat-app\`
4. ✅ **Important**: Mémoriser ce chemin, vous en aurez besoin !
5. Cliquer sur **Extraire**

### Contenu
Après extraction, vous devriez avoir:
```
projet-chat/
├── backend/          (code serveur)
├── frontend/         (interface)
├── prisma/           (base de données)
├── package.json      (dépendances)
├── README.md
└── INSTALLATION.md   (ce fichier)
```

---

## ÉTAPE 4: Configuration du Projet

### Créer le fichier .env
1. Ouvrir le dossier du projet (ex: `C:\projet-chat\`)
2. Clic droit → **Nouveau** → **Document texte**
3. Nommer le fichier: `.env` (avec le point au début)
   - Windows peut afficher un avertissement → Cliquer **Oui**
4. Ouvrir le fichier `.env` avec Bloc-notes
5. Copier-coller ce contenu:

```env
DATABASE_URL="file:./dev.db"
MONGODB_URI="mongodb://localhost:27017/chat-app"
JWT_SECRET="ma_cle_secrete_super_securisee_2024"
SESSION_SECRET="ma_session_secrete_ultra_securisee_2024"
PORT=3000
```

6. **Enregistrer** et fermer le fichier

✅ **Le fichier .env est créé !**

---

## ÉTAPE 5: Installation des Dépendances

### Ouvrir le Terminal
1. Dans le dossier du projet, **Shift + Clic droit** dans une zone vide
2. Choisir **Ouvrir dans le Terminal** ou **Ouvrir une fenêtre PowerShell ici**

### Installer les packages
1. Dans le terminal, taper:
```bash
npm install
```

2. Appuyer sur **Entrée**
3. Attendre l'installation (2-5 minutes)
   - Vous verrez beaucoup de lignes défiler
   - C'est normal !

✅ **Si aucune erreur rouge n'apparaît, c'est bon !**

---

## ÉTAPE 6: Initialisation de la Base de Données

### Créer la structure
Dans le même terminal, taper ces commandes **une par une**:

1. Générer le client Prisma:
```bash
npx prisma generate
```
Appuyer sur Entrée et attendre...

2. Créer la base de données:
```bash
npx prisma db push
```
Appuyer sur Entrée et attendre...

✅ **Vous devriez voir "Your database is now in sync" !**

---

## ÉTAPE 7: Démarrage du Serveur

### Lancer l'application
Dans le terminal, taper:
```bash
npm start
```

### Ce qui va se passer
- Le serveur va démarrer
- Vous verrez des messages verts:
  ```
  ✅ MongoDB connecté avec succès
  🚀 Serveur démarré sur http://localhost:3000
  📡 Socket.io prêt
  ```

✅ **L'application est maintenant lancée !**

---

## ÉTAPE 8: Accéder à l'Application

### Ouvrir dans le navigateur
1. Ouvrir votre navigateur web (Chrome, Firefox, Edge...)
2. Dans la barre d'adresse, taper:
```
http://localhost:3000
```
3. Appuyer sur **Entrée**

### Première utilisation
1. Vous arrivez sur la page de connexion
2. Cliquer sur **S'inscrire**
3. Créer votre premier compte:
   - Nom d'utilisateur
   - Email
   - Mot de passe (min. 6 caractères)
4. Cliquer sur **S'inscrire**

✅ **Bienvenue dans votre application de messagerie !**

---

## 🛑 Arrêter le Serveur

Pour arrêter le serveur:
1. Revenir dans le terminal
2. Appuyer sur **Ctrl + C**
3. Confirmer avec **Y** (Yes) si demandé

---

## 🔄 Redémarrer le Serveur Plus Tard

1. Ouvrir un terminal dans le dossier du projet
2. Taper: `npm start`
3. Ouvrir: `http://localhost:3000`

---

## 📦 Structure du Projet

Votre dossier devrait contenir:

```
projet-chat/
├── backend/
│   ├── index.js              # 🖥️ Serveur principal
│   ├── models/               # 📊 Modèles de données
│   │   └── Message.js
│   ├── routes/               # 🛤️ Routes API
│   │   ├── auth.js          # Connexion/Inscription
│   │   ├── friends.js       # Gestion amis
│   │   └── groups.js        # Gestion groupes
│   ├── uploads/              # 📁 Fichiers uploadés
│   └── utils/
│       └── db.js            # Configuration bases de données
├── frontend/
│   ├── index.html           # 🏠 Page principale
│   ├── css/                 # 🎨 Styles
│   │   ├── style.css
│   │   └── mobile.css
│   └── js/                  # ⚡ Scripts
│       ├── app.js           # Application principale
│       ├── auth.js          # Gestion connexion
│       └── group-management.js
├── prisma/
│   └── schema.prisma        # 🗄️ Schéma base de données
├── .env                     # ⚙️ Configuration (à créer)
├── package.json             # 📦 Dépendances
├── README.md
└── INSTALLATION.md          # 📖 Ce fichier
```

---

## 🎮 Fonctionnalités de l'Application

### 👤 Authentification
- ✅ Inscription avec email, nom d'utilisateur et mot de passe
- ✅ Connexion sécurisée avec sessions
- ✅ Avatar personnalisable

### 💬 Messagerie
- ✅ Messages privés entre amis
- ✅ Messages de groupe
- ✅ Partage de fichiers et images
- ✅ Indicateurs "en train d'écrire..."
- ✅ Indicateurs de lecture (vu/non vu)
- ✅ Historique des messages persistant

### 👥 Gestion des Contacts
- ✅ Recherche d'utilisateurs par nom ou email
- ✅ Envoi de demandes d'ami
- ✅ Acceptation/refus des demandes
- ✅ Suppression d'amis
- ✅ Statut en ligne/hors ligne

### 👨‍👩‍👧‍👦 Groupes
- ✅ Création de groupes
- ✅ Ajout/suppression de membres
- ✅ Gestion des permissions (créateur)
- ✅ Transfert de propriété
- ✅ Avatar de groupe personnalisable
- ✅ Quitter un groupe

### 📞 Appels Vidéo
- ✅ Appels vidéo peer-to-peer (WebRTC)
- ✅ Appels entre amis uniquement
- ✅ Qualité HD selon connexion

---

## ❌ Problèmes Courants et Solutions

### Problème 1: "npm n'est pas reconnu"
**Cause**: Node.js n'est pas installé ou terminal pas redémarré

**Solution**:
1. Fermer **tous** les terminaux ouverts
2. Ouvrir un **nouveau** terminal
3. Retaper la commande
4. Si ça ne marche toujours pas, réinstaller Node.js

---

### Problème 2: "Cannot find module"
**Cause**: Les dépendances ne sont pas installées

**Solution**:
```bash
npm install
```

---

### Problème 3: "Port 3000 already in use"
**Cause**: Le serveur tourne déjà ou un autre programme utilise le port 3000

**Solution 1** - Arrêter l'ancien serveur:
1. Chercher le terminal où le serveur tourne
2. Appuyer sur **Ctrl + C**

**Solution 2** - Changer le port:
1. Ouvrir le fichier `.env`
2. Changer `PORT=3000` en `PORT=8080`
3. Enregistrer
4. Redémarrer le serveur
5. Ouvrir `http://localhost:8080`

---

### Problème 4: MongoDB ne démarre pas
**Cause**: Service MongoDB arrêté

**Solution**:
1. Appuyer sur **Windows + R**
2. Taper: `services.msc`
3. Chercher **MongoDB** dans la liste
4. Clic droit → **Démarrer**

---

### Problème 5: "Prisma schema parsing error"
**Cause**: Problème de génération du client Prisma

**Solution**:
```bash
npx prisma generate
npx📝 Notes Importantes

### Sécurité
⚠️ **Pour un usage en production** (serveur accessible sur Internet):
- Changer les valeurs de `JWT_SECRET` et `SESSION_SECRET` dans `.env`
- Utiliser des mots de passe complexes
- Activer HTTPS

### Sauvegarde
💾 **Vos données sont dans**:
- `dev.db` - Base de données SQLite (utilisateurs, amis, groupes)
- MongoDB - Messages de chat

Pour sauvegarder: copier ces fichiers régulièrement

### Performances
- L'application supporte plusieurs utilisateurs simultanés
- Les appels vidéo sont peer-to-peer (pas de serveur intermédiaire)
- Les fichiers uploadés sont dans `backend/uploads/`

---

## 🎯 Que Faire Maintenant ?

### Tester l'application
1. ✅ Créer 2 comptes (ouvrir un autre navigateur en navigation privée)
2. ✅ Envoyer une demande d'ami
3. ✅ Accepter la demande
4. ✅ Échanger des messages
5. ✅ Créer un groupe
6. ✅ Tester un appel vidéo

### Personnaliser
- Ajouter un avatar personnel
- Créer des groupes thématiques
- Inviter d'autres utilisateurs

---

## 📚 Technologies Utilisées

### Backend (Serveur)
- **Node.js** - Moteur JavaScript
- **Express** - Framework web
- **Socket.io** - Communication temps réel
- **Prisma** - Gestion base de données SQLite
- **Mongoose** - Gestion MongoDB
- **Bcrypt** - Sécurité mots de passe

### Frontend (Interface)
- **HTML5/CSS3** - Structure et style
- **JavaScript** - Logique application
- **Socket.io Client** - Temps réel
- **WebRTC** - Appels vidéo

---

## ✅ Checklist d'Installation

Cocher au fur et à mesure:

- [ ] Node.js installé et vérifié
- [ ] MongoDB installé et service démarré
- [ ] Projet extrait dans un dossier
- [ ] Fichier `.env` créé
- [ ] `npm install` exécuté sans erreur
- [ ] `npx prisma generate` réussi
- [ ] `npx prisma db push` réussi
- [ ] Serveur démarré avec `npm start`
- [ ] Application accessible sur http://localhost:3000
- [ ] Compte créé et connexion réussie

---

## 📞 Besoin d'Aide ?

Si vous rencontrez un problème:

1. ✅ Relire la section "Problèmes Courants"
2. ✅ Vérifier les messages d'erreur dans le terminal
3. ✅ Vérifier que MongoDB tourne
4. ✅ Essayer la réinitialisation complète
5. ✅ Vérifier que Node.js et npm fonctionnent

---

## 📄 Licence

Ce projet est un **Travail de Fin d'Études (TFE)** - Application de messagerie en temps réel.

**Bon courage avec votre installation ! 🚀**
2. Créer un nouveau compte
3. Se connecter avec les nouveaux identifiants

---

### Problème 7: Les messages ne s'affichent pas
**Cause**: MongoDB pas démarré

**Solution**:
1. Vérifier que MongoDB tourne (voir Problème 4)
2. Redémarrer le serveur:
   - **Ctrl + C** dans le terminal
   - Retaper `npm start`

---

### Problème 8: Erreur lors de npm install
**Cause**: Problème de connexion internet ou cache npm

**Solution**:
```bash
npm cache clean --force
npm install
```

---

## 🔧 Commandes Utiles

### Démarrage
- `npm start` - Démarre le serveur
- `npm run dev` - Mode développement (redémarrage auto)

### Base de données
- `npx prisma studio` - Interface graphique pour voir les données
- `npx prisma db push` - Appliquer les changements du schéma
- `npx prisma generate` - Régénérer le client Prisma

### Nettoyage
- `npm cache clean --force` - Nettoyer le cache npm

### Réinitialisation complète
Si rien ne fonctionne:
```bash
del dev.db
del -r node_modules
npm install
npx prisma generate
npx prisma db push
npm start
```

## Technologies Utilisées

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **Socket.io** - WebSockets temps réel
- **Prisma** - ORM pour SQLite
- **Mongoose** - ODM pour MongoDB
- **bcrypt** - Hachage de mots de passe
- **jsonwebtoken** - Authentification JWT
- **multer** - Upload de fichiers

### Frontend
- **HTML5/CSS3** - Interface utilisateur
- **JavaScript Vanilla** - Logique frontend
- **Socket.io Client** - Communication temps réel
- **WebRTC** - Appels vidéo peer-to-peer

## Support et Contact

Pour toute question ou problème:
1. Vérifier ce guide d'installation
2. Consulter la documentation officielle des technologies utilisées
3. Vérifier les logs du serveur dans la console

## Licence

Ce projet est un travail de fin d'études (TFE).
