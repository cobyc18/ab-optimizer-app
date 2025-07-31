const { PrismaClient } = require('@prisma/client');

async function testDatabase() {
  console.log('🔍 Testing database connection...');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    console.log('Please set DATABASE_URL in your Render environment variables.');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL is set');
  console.log('📍 Database URL:', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':****@')); // Hide password

  const prisma = new PrismaClient();

  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Successfully connected to database');

    // Test if tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log('📋 Available tables:', tables.map(t => t.table_name));

    // Test ABTest table specifically
    try {
      const abTests = await prisma.aBTest.findMany({ take: 1 });
      console.log('✅ ABTest table is accessible');
      console.log(`📊 Found ${abTests.length} A/B tests`);
    } catch (error) {
      console.error('❌ ABTest table error:', error.message);
    }

    // Test Shop table specifically
    try {
      const shops = await prisma.shop.findMany({ take: 1 });
      console.log('✅ Shop table is accessible');
      console.log(`🏪 Found ${shops.length} shops`);
    } catch (error) {
      console.error('❌ Shop table error:', error.message);
    }

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  console.log('🎉 Database test completed successfully!');
}

testDatabase().catch(console.error); 