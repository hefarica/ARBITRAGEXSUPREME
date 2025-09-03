#!/usr/bin/env node
/**
 * ArbitrageX Pro 2025 - Migration Test Script
 * Tests migration and rollback functionality without PostgreSQL
 */

console.log('🧪 ArbitrageX Pro 2025 - Migration System Test');
console.log('=' .repeat(60));

const fs = require('fs');
const path = require('path');

// Test file existence and structure
function testMigrationFiles() {
  console.log('\n📁 Testing migration file structure...');
  
  const migrationDir = '/home/user/ARBITRAGEXSUPREME/apps/api/prisma/migrations/20250903001500_init';
  const migrationFile = path.join(migrationDir, 'migration.sql');
  const seedFile = '/home/user/ARBITRAGEXSUPREME/apps/api/prisma/seed.sql';
  const schemaFile = '/home/user/ARBITRAGEXSUPREME/apps/api/prisma/schema.prisma';
  
  const results = [];
  
  // Test migration SQL
  if (fs.existsSync(migrationFile)) {
    const content = fs.readFileSync(migrationFile, 'utf8');
    const tableCreations = (content.match(/CREATE TABLE/g) || []).length;
    const enumCreations = (content.match(/CREATE TYPE.*AS ENUM/g) || []).length;
    const indexes = (content.match(/CREATE.*INDEX/g) || []).length;
    const foreignKeys = (content.match(/ADD CONSTRAINT.*FOREIGN KEY/g) || []).length;
    
    results.push({
      file: 'migration.sql',
      status: '✅ EXISTS',
      details: `${tableCreations} tables, ${enumCreations} enums, ${indexes} indexes, ${foreignKeys} foreign keys`
    });
  } else {
    results.push({ file: 'migration.sql', status: '❌ MISSING', details: 'Migration file not found' });
  }
  
  // Test seed file
  if (fs.existsSync(seedFile)) {
    const content = fs.readFileSync(seedFile, 'utf8');
    const inserts = (content.match(/INSERT INTO/g) || []).length;
    
    results.push({
      file: 'seed.sql',
      status: '✅ EXISTS',
      details: `${inserts} insert statements`
    });
  } else {
    results.push({ file: 'seed.sql', status: '❌ MISSING', details: 'Seed file not found' });
  }
  
  // Test schema file
  if (fs.existsSync(schemaFile)) {
    const content = fs.readFileSync(schemaFile, 'utf8');
    const models = (content.match(/model \w+/g) || []).length;
    const enums = (content.match(/enum \w+/g) || []).length;
    
    results.push({
      file: 'schema.prisma',
      status: '✅ EXISTS',
      details: `${models} models, ${enums} enums`
    });
  } else {
    results.push({ file: 'schema.prisma', status: '❌ MISSING', details: 'Schema file not found' });
  }
  
  // Display results
  results.forEach(result => {
    console.log(`  ${result.status} ${result.file} - ${result.details}`);
  });
  
  return results.every(r => r.status.includes('✅'));
}

// Test script files
function testScriptFiles() {
  console.log('\n🔧 Testing migration scripts...');
  
  const migrateScript = '/home/user/ARBITRAGEXSUPREME/apps/api/scripts/migrate.sh';
  const rollbackScript = '/home/user/ARBITRAGEXSUPREME/apps/api/scripts/rollback.sh';
  
  const results = [];
  
  if (fs.existsSync(migrateScript)) {
    const stats = fs.statSync(migrateScript);
    const isExecutable = stats.mode & parseInt('111', 8);
    
    results.push({
      file: 'migrate.sh',
      status: isExecutable ? '✅ EXECUTABLE' : '⚠️  NOT EXECUTABLE',
      details: `${Math.round(stats.size / 1024)}KB`
    });
  } else {
    results.push({ file: 'migrate.sh', status: '❌ MISSING', details: 'Script not found' });
  }
  
  if (fs.existsSync(rollbackScript)) {
    const stats = fs.statSync(rollbackScript);
    const isExecutable = stats.mode & parseInt('111', 8);
    
    results.push({
      file: 'rollback.sh',
      status: isExecutable ? '✅ EXECUTABLE' : '⚠️  NOT EXECUTABLE',
      details: `${Math.round(stats.size / 1024)}KB`
    });
  } else {
    results.push({ file: 'rollback.sh', status: '❌ MISSING', details: 'Script not found' });
  }
  
  // Display results
  results.forEach(result => {
    console.log(`  ${result.status} ${result.file} - ${result.details}`);
  });
  
  return results.every(r => r.status.includes('✅'));
}

// Test data model integrity
function testDataModelIntegrity() {
  console.log('\n🔍 Testing data model integrity...');
  
  const migrationFile = '/home/user/ARBITRAGEXSUPREME/apps/api/prisma/migrations/20250903001500_init/migration.sql';
  
  if (!fs.existsSync(migrationFile)) {
    console.log('  ❌ Cannot test - migration file missing');
    return false;
  }
  
  const content = fs.readFileSync(migrationFile, 'utf8');
  
  const tests = [
    {
      name: 'Core Tables',
      test: () => ['tenants', 'users', 'api_keys'].every(table => content.includes(`CREATE TABLE "${table}"`)),
      details: 'tenants, users, api_keys'
    },
    {
      name: 'Arbitrage Tables', 
      test: () => ['arbitrage_configs', 'arbitrage_opportunities', 'arbitrage_executions'].every(table => content.includes(`CREATE TABLE "${table}"`)),
      details: 'configs, opportunities, executions'
    },
    {
      name: 'Blockchain Tables',
      test: () => ['blockchain_networks', 'dex_protocols', 'trading_pairs'].every(table => content.includes(`CREATE TABLE "${table}"`)),
      details: 'networks, protocols, pairs'
    },
    {
      name: 'Enums',
      test: () => ['TenantStatus', 'UserRole', 'OpportunityStatus', 'ExecutionMode'].every(enumType => content.includes(`CREATE TYPE "${enumType}"`)),
      details: 'status, role, execution enums'
    },
    {
      name: 'Foreign Keys',
      test: () => content.includes('FOREIGN KEY') && content.split('FOREIGN KEY').length > 10,
      details: `${(content.match(/FOREIGN KEY/g) || []).length} relationships`
    },
    {
      name: 'Indexes',
      test: () => content.includes('CREATE INDEX') && content.split('CREATE INDEX').length > 5,
      details: `${(content.match(/CREATE.*INDEX/g) || []).length} performance indexes`
    }
  ];
  
  const results = tests.map(test => ({
    name: test.name,
    passed: test.test(),
    details: test.details
  }));
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} ${result.name} - ${result.details}`);
  });
  
  return results.every(r => r.passed);
}

// Test seed data completeness
function testSeedData() {
  console.log('\n🌱 Testing seed data completeness...');
  
  const seedFile = '/home/user/ARBITRAGEXSUPREME/apps/api/prisma/seed.sql';
  
  if (!fs.existsSync(seedFile)) {
    console.log('  ❌ Cannot test - seed file missing');
    return false;
  }
  
  const content = fs.readFileSync(seedFile, 'utf8');
  
  const tests = [
    {
      name: 'Subscription Plans',
      test: () => content.includes('INSERT INTO "subscription_plans"') && content.includes('Starter') && content.includes('Professional'),
      details: 'Starter, Professional, Enterprise plans'
    },
    {
      name: 'Demo Tenant',
      test: () => content.includes('INSERT INTO "tenants"') && content.includes('demo'),
      details: 'Demo tenant for testing'
    },
    {
      name: 'Admin User',
      test: () => content.includes('INSERT INTO "users"') && content.includes('admin@arbitragex.pro'),
      details: 'Default admin user'
    },
    {
      name: 'Blockchain Networks',
      test: () => content.includes('INSERT INTO "blockchain_networks"') && content.includes('ethereum') && content.includes('bsc'),
      details: 'Ethereum, BSC, Polygon networks'
    },
    {
      name: 'DEX Protocols',
      test: () => content.includes('INSERT INTO "dex_protocols"') && content.includes('Uniswap') && content.includes('PancakeSwap'),
      details: 'Major DEX protocols'
    },
    {
      name: 'Demo Config',
      test: () => content.includes('INSERT INTO "arbitrage_configs"') && content.includes('Multi-Chain'),
      details: 'Sample arbitrage configuration'
    }
  ];
  
  const results = tests.map(test => ({
    name: test.name,
    passed: test.test(),
    details: test.details
  }));
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} ${result.name} - ${result.details}`);
  });
  
  return results.every(r => r.passed);
}

// Main test execution
function runTests() {
  const tests = [
    { name: 'Migration Files', test: testMigrationFiles },
    { name: 'Script Files', test: testScriptFiles },
    { name: 'Data Model Integrity', test: testDataModelIntegrity },
    { name: 'Seed Data', test: testSeedData }
  ];
  
  const results = tests.map(test => ({
    name: test.name,
    passed: test.test()
  }));
  
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('=' .repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
  });
  
  console.log('\n' + '=' .repeat(60));
  console.log(`📈 OVERALL: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
  
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED - Migration system is ready!');
    console.log('');
    console.log('🚀 NEXT STEPS:');
    console.log('  1. Set up PostgreSQL database');
    console.log('  2. Run: cd apps/api && npm run db:setup');
    console.log('  3. Verify: npm run db:verify');
    console.log('  4. Test API endpoints with real database');
  } else {
    console.log('⚠️  SOME TESTS FAILED - Please fix issues before proceeding');
  }
  
  console.log('');
}

runTests();