/**
 * Gestionnaire des connexions aux bases de données.
 * Centralise l'accès à MySQL (via Prisma) et MongoDB (via Mongoose).
 */
const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');

// Instance Prisma pour MySQL
const prisma = new PrismaClient();

// Établit la connexion à MongoDB
const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ MongoDB connecté avec succès');
    return true;
  } catch (error) {
    console.warn('⚠️ MongoDB non disponible:', error.message);
    console.warn('   L\'application fonctionnera sans persistance des messages');
    return false;
  }
};

// Ferme proprement toutes les connexions
const disconnectDatabases = async () => {
  await prisma.$disconnect();
  await mongoose.connection.close();
  console.log('🔌 Bases de données déconnectées');
};

module.exports = {
  prisma,
  connectMongoDB,
  disconnectDatabases
};
