const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');

// Connexion Prisma (MySQL)
const prisma = new PrismaClient();

// Connexion MongoDB
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

// Gestion de la déconnexion propre
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
