#!/bin/bash
# ArbitrageX Pro 2025 - Database Migration Script
# Handles database setup, migrations, and seeding

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="arbitragex_pro"
DB_USER="arbitragex"
DB_PASSWORD="password"
DB_HOST="localhost"
DB_PORT="5432"

echo -e "${BLUE}🚀 ArbitrageX Pro 2025 - Database Migration${NC}"
echo "=============================================="

# Function to check if PostgreSQL is running
check_postgres() {
    echo -e "${YELLOW}📊 Checking PostgreSQL connection...${NC}"
    
    if command -v psql >/dev/null 2>&1; then
        if psql -h $DB_HOST -p $DB_PORT -U postgres -c "SELECT 1;" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL is running${NC}"
            return 0
        else
            echo -e "${RED}❌ Cannot connect to PostgreSQL${NC}"
            echo "Please ensure PostgreSQL is running and accessible"
            return 1
        fi
    else
        echo -e "${RED}❌ psql command not found${NC}"
        echo "Please install PostgreSQL client"
        return 1
    fi
}

# Function to create database and user
setup_database() {
    echo -e "${YELLOW}🔧 Setting up database and user...${NC}"
    
    # Create database user if not exists
    psql -h $DB_HOST -p $DB_PORT -U postgres -c "
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USER') THEN
                CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
            END IF;
        END
        \$\$;
    " 2>/dev/null || true
    
    # Create database if not exists
    psql -h $DB_HOST -p $DB_PORT -U postgres -c "
        SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec
    " 2>/dev/null || true
    
    # Grant privileges
    psql -h $DB_HOST -p $DB_PORT -U postgres -c "
        GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
        ALTER USER $DB_USER CREATEDB;
    " 2>/dev/null || true
    
    echo -e "${GREEN}✅ Database setup complete${NC}"
}

# Function to run migrations
run_migrations() {
    echo -e "${YELLOW}📋 Running database migrations...${NC}"
    
    # Set DATABASE_URL for this session
    export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
    
    # Check if migration table exists
    MIGRATION_EXISTS=$(psql $DATABASE_URL -t -c "
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'tenants'
        );
    " 2>/dev/null | xargs)
    
    if [ "$MIGRATION_EXISTS" = "f" ]; then
        echo -e "${BLUE}🔨 Applying initial migration...${NC}"
        
        # Run the migration SQL file
        if [ -f "prisma/migrations/20250903001500_init/migration.sql" ]; then
            psql $DATABASE_URL -f "prisma/migrations/20250903001500_init/migration.sql"
            echo -e "${GREEN}✅ Initial migration applied successfully${NC}"
        else
            echo -e "${RED}❌ Migration file not found${NC}"
            return 1
        fi
    else
        echo -e "${GREEN}✅ Database already migrated${NC}"
    fi
}

# Function to run seeds
run_seeds() {
    echo -e "${YELLOW}🌱 Running database seeds...${NC}"
    
    # Set DATABASE_URL for this session
    export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
    
    # Check if data already exists
    TENANT_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM tenants;" 2>/dev/null | xargs)
    
    if [ "$TENANT_COUNT" = "0" ]; then
        echo -e "${BLUE}🌱 Seeding initial data...${NC}"
        
        if [ -f "prisma/seed.sql" ]; then
            psql $DATABASE_URL -f "prisma/seed.sql"
            echo -e "${GREEN}✅ Seeds applied successfully${NC}"
        else
            echo -e "${RED}❌ Seed file not found${NC}"
            return 1
        fi
    else
        echo -e "${GREEN}✅ Database already seeded (${TENANT_COUNT} tenants found)${NC}"
    fi
}

# Function to verify installation
verify_installation() {
    echo -e "${YELLOW}🔍 Verifying installation...${NC}"
    
    export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
    
    # Count tables
    TABLE_COUNT=$(psql $DATABASE_URL -t -c "
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    " 2>/dev/null | xargs)
    
    # Count records in key tables
    TENANT_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM tenants;" 2>/dev/null | xargs)
    NETWORK_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM blockchain_networks;" 2>/dev/null | xargs)
    DEX_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM dex_protocols;" 2>/dev/null | xargs)
    
    echo -e "${GREEN}📊 Database Statistics:${NC}"
    echo "  • Tables created: $TABLE_COUNT"
    echo "  • Tenants: $TENANT_COUNT"
    echo "  • Blockchain networks: $NETWORK_COUNT"
    echo "  • DEX protocols: $DEX_COUNT"
    
    if [ "$TABLE_COUNT" -ge "15" ] && [ "$TENANT_COUNT" -ge "1" ] && [ "$NETWORK_COUNT" -ge "3" ]; then
        echo -e "${GREEN}✅ Database installation verified successfully!${NC}"
        return 0
    else
        echo -e "${RED}❌ Database installation verification failed${NC}"
        return 1
    fi
}

# Main execution
main() {
    case "${1:-setup}" in
        "setup"|"")
            if check_postgres; then
                setup_database
                run_migrations
                run_seeds
                verify_installation
                echo -e "${GREEN}🎉 Database setup complete!${NC}"
                echo ""
                echo -e "${BLUE}📝 Connection Details:${NC}"
                echo "  Database: $DB_NAME"
                echo "  User: $DB_USER"
                echo "  Host: $DB_HOST:$DB_PORT"
                echo "  URL: postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
                echo ""
                echo -e "${YELLOW}🔗 Update your .env file with:${NC}"
                echo "DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME\""
            fi
            ;;
        "migrate")
            if check_postgres; then
                run_migrations
            fi
            ;;
        "seed")
            if check_postgres; then
                run_seeds
            fi
            ;;
        "verify")
            if check_postgres; then
                verify_installation
            fi
            ;;
        "reset")
            echo -e "${RED}⚠️  WARNING: This will completely reset the database!${NC}"
            read -p "Are you sure? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
                psql -h $DB_HOST -p $DB_PORT -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
                echo -e "${GREEN}✅ Database reset. Run 'setup' to recreate.${NC}"
            fi
            ;;
        *)
            echo "Usage: $0 {setup|migrate|seed|verify|reset}"
            echo ""
            echo "Commands:"
            echo "  setup   - Full database setup (default)"
            echo "  migrate - Run migrations only"
            echo "  seed    - Run seeds only"
            echo "  verify  - Verify installation"
            echo "  reset   - Reset database (WARNING: destructive)"
            exit 1
            ;;
    esac
}

main "$@"