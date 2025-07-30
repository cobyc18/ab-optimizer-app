const { PrismaClient } = require('@prisma/client');

async function testDatabase() {
  console.log('🔍 Testing database connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    process.exit(1);
  }

  try {
    const prisma = new PrismaClient();
    
    // Test connection
    console.log('🔌 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Check if tables exist
    console.log('📋 Checking for existing tables...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('📊 Existing tables:', tables.map(t => t.table_name));
    
    // Check specifically for Session table
    const sessionTable = tables.find(t => t.table_name === 'Session');
    if (sessionTable) {
      console.log('✅ Session table exists!');
    } else {
      console.log('❌ Session table does not exist');
    }
    
    await prisma.$disconnect();
    console.log('✅ Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testDatabase(); 