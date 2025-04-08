// Check PostgreSQL Connection
require('dotenv').config();
const { pool, connectToDB } = require('../models/pgdb');

// Test the connection
async function testConnection() {
  console.log('Testing PostgreSQL connection...');
  
  try {
    const connected = await connectToDB();
    
    if (connected) {
      console.log('✅ PostgreSQL connection successful!');
      
      // Test a query
      console.log('Testing a simple query...');
      const client = await pool.connect();
      const result = await client.query('SELECT current_timestamp as now');
      console.log('Query result:', result.rows[0]);
      client.release();
      
      // Display connection info
      console.log('\nConnection information:');
      if (process.env.DATABASE_URL) {
        const hiddenPassword = process.env.DATABASE_URL.replace(
          /:\/\/([^:]+):([^@]+)@/,
          '://$1:****@'
        );
        console.log(`Database URL: ${hiddenPassword}`);
      } else {
        console.log('Using individual connection parameters (not showing for security)');
      }
      
      // Show table structure if tables exist
      try {
        const tablesClient = await pool.connect();
        const tablesResult = await tablesClient.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
        
        console.log('\nDatabase tables:');
        if (tablesResult.rows.length > 0) {
          for (const row of tablesResult.rows) {
            console.log(`- ${row.table_name}`);
          }
        } else {
          console.log('No tables found. Database needs initialization.');
        }
        
        tablesClient.release();
      } catch (error) {
        console.error('Error retrieving table information:', error);
      }
    } else {
      console.error('❌ PostgreSQL connection failed');
    }
  } catch (error) {
    console.error('Error testing connection:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the test
testConnection().catch(console.error);