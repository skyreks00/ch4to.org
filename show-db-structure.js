/**
 * Script de présentation de la STRUCTURE des bases de données
 * Affiche le schéma complet de MySQL et MongoDB
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');

const prisma = new PrismaClient();

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m'
};

function printHeader(title, color = colors.cyan) {
  console.log('\n' + '═'.repeat(80));
  console.log(color + colors.bright + '  ' + title + colors.reset);
  console.log('═'.repeat(80));
}

function printTable(tableName, icon = '📋') {
  console.log('\n' + colors.bright + icon + ' Table: ' + colors.yellow + tableName + colors.reset);
  console.log('─'.repeat(80));
}

function printField(name, type, constraints = []) {
  const constraintsStr = constraints.length > 0 ? colors.dim + ' (' + constraints.join(', ') + ')' + colors.reset : '';
  console.log(`  ${colors.green}├─${colors.reset} ${colors.cyan}${name}${colors.reset}: ${type}${constraintsStr}`);
}

function printLastField(name, type, constraints = []) {
  const constraintsStr = constraints.length > 0 ? colors.dim + ' (' + constraints.join(', ') + ')' + colors.reset : '';
  console.log(`  ${colors.green}└─${colors.reset} ${colors.cyan}${name}${colors.reset}: ${type}${constraintsStr}`);
}

function printRelation(relation) {
  console.log(`  ${colors.blue}🔗 ${relation}${colors.reset}`);
}

function printIndex(index) {
  console.log(`  ${colors.magenta}📌 ${index}${colors.reset}`);
}

async function showMySQLStructure() {
  printHeader('🔵 STRUCTURE MYSQL - Base relationnelle', colors.cyan);
  
  console.log('\n' + colors.bright + 'Architecture: Prisma ORM avec MySQL' + colors.reset);
  console.log('Objectif: Gestion des utilisateurs, relations sociales et groupes\n');

  // Table Users
  printTable('users', '👤');
  printField('id', 'INT', ['PRIMARY KEY', 'AUTO_INCREMENT']);
  printField('username', 'VARCHAR(50)', ['UNIQUE', 'NOT NULL']);
  printField('email', 'VARCHAR(100)', ['UNIQUE', 'NOT NULL']);
  printField('password', 'VARCHAR(255)', ['NOT NULL']);
  printField('avatar', 'VARCHAR(255)', ['NULLABLE']);
  printField('created_at', 'DATETIME', ['DEFAULT NOW()']);
  printLastField('last_login', 'DATETIME', ['NULLABLE']);
  printRelation('Relations: friendRequestsSent[], friendRequestsReceived[], groupMemberships[]');

  // Table Friendships
  printTable('friendships', '🤝');
  printField('id', 'INT', ['PRIMARY KEY', 'AUTO_INCREMENT']);
  printField('sender_id', 'INT', ['FOREIGN KEY → users.id', 'CASCADE']);
  printField('receiver_id', 'INT', ['FOREIGN KEY → users.id', 'CASCADE']);
  printField('status', "VARCHAR(20) ENUM('pending', 'accepted', 'rejected')", ['NOT NULL']);
  printLastField('created_at', 'DATETIME', ['DEFAULT NOW()']);
  printIndex('UNIQUE INDEX: (sender_id, receiver_id)');
  printRelation('Relations: sender → User, receiver → User');

  // Table Groups
  printTable('groups', '👥');
  printField('id', 'INT', ['PRIMARY KEY', 'AUTO_INCREMENT']);
  printField('name', 'VARCHAR(100)', ['NOT NULL']);
  printField('avatar', 'VARCHAR(255)', ['NULLABLE']);
  printField('creator_id', 'INT', ['NOT NULL']);
  printLastField('created_at', 'DATETIME', ['DEFAULT NOW()']);
  printRelation('Relations: members[]');

  // Table Group_Members
  printTable('group_members', '👤👥');
  printField('id', 'INT', ['PRIMARY KEY', 'AUTO_INCREMENT']);
  printField('group_id', 'INT', ['FOREIGN KEY → groups.id', 'CASCADE']);
  printField('user_id', 'INT', ['FOREIGN KEY → users.id', 'CASCADE']);
  printLastField('joined_at', 'DATETIME', ['DEFAULT NOW()']);
  printIndex('UNIQUE INDEX: (group_id, user_id)');
  printRelation('Relations: group → Group, user → User');

  // Statistiques
  try {
    const userCount = await prisma.user.count();
    const friendshipCount = await prisma.friendship.count();
    const groupCount = await prisma.group.count();
    const memberCount = await prisma.groupMember.count();

    console.log('\n' + colors.yellow + '📊 Données actuelles:' + colors.reset);
    console.log(`  • Utilisateurs: ${colors.bright}${userCount}${colors.reset}`);
    console.log(`  • Relations d'amitié: ${colors.bright}${friendshipCount}${colors.reset}`);
    console.log(`  • Groupes: ${colors.bright}${groupCount}${colors.reset}`);
    console.log(`  • Membres de groupes: ${colors.bright}${memberCount}${colors.reset}`);
  } catch (error) {
    console.log('\n' + colors.red + '⚠️ Impossible de récupérer les statistiques' + colors.reset);
  }
}

async function showMongoDBStructure() {
  printHeader('🟢 STRUCTURE MONGODB - Base NoSQL', colors.green);
  
  console.log('\n' + colors.bright + 'Architecture: Mongoose ODM avec MongoDB' + colors.reset);
  console.log('Objectif: Stockage flexible des messages de chat en temps réel\n');

  // Collection Messages
  printTable('messages', '💬');
  printField('_id', 'ObjectId', ['PRIMARY KEY', 'AUTO-GENERATED']);
  printField('username', 'String', ['REQUIRED', 'TRIMMED']);
  printField('senderId', 'Number', ['REQUIRED', 'Référence users.id MySQL']);
  printField('avatar', 'String', ['DEFAULT NULL']);
  printField('content', 'String', ['REQUIRED', 'MAX 5000 chars']);
  printField('type', "String ENUM('text', 'image', 'file', 'system')", ['DEFAULT text']);
  printField('fileUrl', 'String', ['DEFAULT NULL', 'URL du fichier uploadé']);
  printField('readBy', 'Array[Number]', ['Liste des IDs ayant lu']);
  printField('conversationId', 'String', ['REQUIRED', 'Identifiant de conversation']);
  printLastField('timestamp', 'Date', ['DEFAULT Date.now()']);
  
  console.log('\n' + colors.magenta + '  🔷 Champs virtuels:' + colors.reset);
  printField('message', 'Virtual', ['Alias de content pour compatibilité frontend']);

  console.log('\n' + colors.magenta + '  📌 Index d\'optimisation:' + colors.reset);
  printIndex('INDEX COMPOSÉ: conversationId (↑) + timestamp (↓) → recherche rapide par conversation');
  printIndex('INDEX SIMPLE: senderId (↑) → recherche rapide par expéditeur');

  console.log('\n' + colors.yellow + '  💡 Format conversationId:' + colors.reset);
  console.log(`     • private_X_Y → conversation privée entre users X et Y`);
  console.log(`     • group_Z → conversation de groupe Z`);

  // Statistiques
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Message = require('./backend/models/Message');
    const totalMessages = await Message.countDocuments();
    const messagesByType = await Message.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    const conversations = await Message.distinct('conversationId');

    console.log('\n' + colors.yellow + '📊 Données actuelles:' + colors.reset);
    console.log(`  • Total messages: ${colors.bright}${totalMessages}${colors.reset}`);
    messagesByType.forEach(stat => {
      console.log(`  • Messages ${stat._id}: ${colors.bright}${stat.count}${colors.reset}`);
    });
    console.log(`  • Conversations actives: ${colors.bright}${conversations.length}${colors.reset}`);
    
  } catch (error) {
    console.log('\n' + colors.red + '⚠️ MongoDB non disponible ou vide' + colors.reset);
  }
}

function showArchitecture() {
  printHeader('🏗️ ARCHITECTURE HYBRIDE', colors.magenta);
  
  console.log('\n' + colors.bright + '📐 Séparation des responsabilités:' + colors.reset);
  console.log('\n  ' + colors.cyan + '🔵 MySQL (Relationnel)' + colors.reset);
  console.log('     ├─ Données structurées et relationnelles');
  console.log('     ├─ Authentification et profils utilisateurs');
  console.log('     ├─ Relations sociales (amis)');
  console.log('     ├─ Gestion des groupes et membres');
  console.log('     └─ Intégrité référentielle (CASCADE)');

  console.log('\n  ' + colors.green + '🟢 MongoDB (NoSQL)' + colors.reset);
  console.log('     ├─ Données non structurées et flexibles');
  console.log('     ├─ Messages de chat en temps réel');
  console.log('     ├─ Historique de conversations');
  console.log('     ├─ Scalabilité horizontale');
  console.log('     └─ Requêtes rapides par index');

  console.log('\n  ' + colors.yellow + '🔗 Liaison inter-bases:' + colors.reset);
  console.log('     └─ users.id (MySQL) ↔ messages.senderId (MongoDB)');

  console.log('\n' + colors.bright + '✨ Avantages de cette architecture:' + colors.reset);
  console.log('  ✅ MySQL garantit la cohérence des données relationnelles');
  console.log('  ✅ MongoDB optimise les performances pour le chat temps réel');
  console.log('  ✅ Séparation claire des préoccupations');
  console.log('  ✅ Scalabilité indépendante de chaque base');
  console.log('  ✅ Flexibilité pour ajouter de nouveaux types de messages');
}

async function main() {
  console.clear();
  printHeader('📚 PRÉSENTATION DE LA STRUCTURE DES BASES DE DONNÉES', colors.magenta);
  console.log(colors.bright + '\n  Application de Chat avec Gestion d\'Utilisateurs et Groupes' + colors.reset);
  console.log('  Date: ' + new Date().toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }));

  await showMySQLStructure();
  await showMongoDBStructure();
  showArchitecture();

  printHeader('✨ FIN DE LA PRÉSENTATION', colors.magenta);
  console.log('');
}

main()
  .catch(error => {
    console.error(colors.red + '\n❌ Erreur:', error.message + colors.reset);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.connection.close();
    process.exit(0);
  });
