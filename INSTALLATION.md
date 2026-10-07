# Installation pas à pas (Windows)

Ce guide part d'une machine vierge. Si Node.js, MySQL et MongoDB sont déjà installés, les commandes du [README](README.md) suffisent.

## 1. Installer les outils

**Node.js** : télécharger la version LTS sur [nodejs.org](https://nodejs.org) et l'installer avec les options par défaut. Dans un nouveau terminal, `node --version` doit afficher une version 18 ou plus récente.

**MySQL** : installer MySQL Community Server depuis [dev.mysql.com](https://dev.mysql.com/downloads/mysql/) (MariaDB, par exemple via XAMPP, fonctionne aussi). Noter le mot de passe de l'utilisateur `root` choisi pendant l'installation.

**MongoDB** : installer MongoDB Community Server depuis [mongodb.com](https://www.mongodb.com/try/download/community) en laissant cochée l'option qui l'installe comme service Windows. MongoDB Compass, proposé pendant l'installation, est pratique pour consulter les messages mais pas obligatoire.

## 2. Récupérer le projet

Avec Git :

```bash
git clone https://github.com/skyreks00/ch4to.org.git
cd ch4to.org
```

Sans Git : sur la page GitHub du projet, *Code > Download ZIP*, puis extraire l'archive et ouvrir un terminal dans le dossier extrait.

## 3. Configurer

Créer un fichier `.env` à la racine du projet (à côté de `package.json`) :

```env
DATABASE_URL="mysql://root:MOT_DE_PASSE_MYSQL@localhost:3306/ch4to"
MONGODB_URI="mongodb://localhost:27017/ch4to"
JWT_SECRET="une_longue_chaine_aleatoire"
SESSION_SECRET="une_autre_chaine_aleatoire"
PORT=3000
```

Remplacer `MOT_DE_PASSE_MYSQL` par le mot de passe noté à l'étape 1. Les deux secrets peuvent être n'importe quelles chaînes longues et différentes.

## 4. Installer les dépendances et créer la base

```bash
npm install
npm run prisma:generate
npm run prisma:push
```

`prisma:push` crée la base `ch4to` si elle n'existe pas, puis les tables `users`, `friendships`, `groups` et `group_members`. Côté MongoDB, rien à préparer : la collection des messages est créée au premier message.

## 5. Lancer l'application

```bash
npm start
```

Le terminal doit indiquer que MongoDB est connecté et que le serveur écoute sur le port 3000. Ouvrir http://localhost:3000 dans le navigateur.

Pour tester toutes les fonctions, créer deux comptes (le second dans une fenêtre de navigation privée), les ajouter en amis, échanger quelques messages puis lancer un appel vidéo. Le navigateur demande l'accès à la caméra et au micro.

Pour arrêter le serveur : `Ctrl + C` dans le terminal. Pour le relancer plus tard : `npm start` depuis le dossier du projet.

## Problèmes fréquents

| Symptôme | Cause probable et solution |
| -------- | -------------------------- |
| `npm` n'est pas reconnu | Le terminal a été ouvert avant l'installation de Node.js : en ouvrir un nouveau. |
| Prisma `P1001: Can't reach database server` | MySQL n'est pas démarré, ou l'hôte/le port de `DATABASE_URL` est incorrect. |
| Prisma `P1000: Authentication failed` | Utilisateur ou mot de passe MySQL incorrect dans `DATABASE_URL`. |
| `MongoDB non disponible` au démarrage | Le service MongoDB est arrêté : `Win + R`, `services.msc`, clic droit sur MongoDB, *Démarrer*. Sans MongoDB, les messages ne sont pas enregistrés. |
| `EADDRINUSE` / port 3000 déjà utilisé | Un autre serveur tourne déjà : l'arrêter, ou changer `PORT` dans `.env`. |
| Déconnexion immédiate après la connexion | L'application est ouverte via une adresse IP en HTTP. Le cookie de session exige HTTPS en dehors de `localhost` : utiliser `localhost` ou passer par un tunnel HTTPS (voir `start.bat`). |
| Erreur pendant `npm install` | Relancer après `npm cache clean --force`. |

Pour voir le contenu des deux bases depuis le terminal : `node show-db-structure.js`. Pour MySQL, `npx prisma studio` ouvre aussi une interface dans le navigateur.
