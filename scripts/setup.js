const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function setup() {
  try {
    console.log('🔗 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Check if admin user exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@example.com' }
    });

    if (!existingAdmin) {
      console.log('👤 Creating default admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await prisma.user.create({
        data: {
          email: 'admin@example.com',
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          isActive: true,
        }
      });
      console.log('✅ Default admin user created');
      console.log('📧 Email: admin@example.com');
      console.log('🔑 Password: admin123');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    console.log('🎉 Setup completed successfully!');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setup(); 