#!/bin/bash
# ArbitrageX Pro 2025 - Database Rollback Script
# Handles database rollback and backup operations

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
BACKUP_DIR="./backups"

echo -e "${BLUE}🔄 ArbitrageX Pro 2025 - Database Rollback${NC}"
echo "=============================================="

# Function to create backup directory
ensure_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        echo -e "${GREEN}✅ Created backup directory: $BACKUP_DIR${NC}"
    fi
}

# Function to create backup before rollback
create_backup() {
    local backup_name="${1:-$(date +%Y%m%d_%H%M%S)}"
    local backup_file="$BACKUP_DIR/arbitragex_backup_$backup_name.sql"
    
    echo -e "${YELLOW}💾 Creating backup: $backup_file${NC}"
    
    export PGPASSWORD="$DB_PASSWORD"
    pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=plain \
        > "$backup_file"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backup created successfully${NC}"
        echo "  File: $backup_file"
        echo "  Size: $(du -h "$backup_file" | cut -f1)"
        return 0
    else
        echo -e "${RED}❌ Backup failed${NC}"
        return 1
    fi
}

# Function to list available backups
list_backups() {
    echo -e "${YELLOW}📋 Available backups:${NC}"
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR/*.sql 2>/dev/null)" ]; then
        echo -e "${RED}❌ No backups found in $BACKUP_DIR${NC}"
        return 1
    fi
    
    local count=0
    for backup in "$BACKUP_DIR"/*.sql; do
        if [ -f "$backup" ]; then
            count=$((count + 1))
            local size=$(du -h "$backup" | cut -f1)
            local date=$(stat -c %y "$backup" 2>/dev/null | cut -d' ' -f1,2 | cut -d'.' -f1)
            echo "  $count. $(basename "$backup") ($size) - $date"
        fi
    done
    
    if [ $count -eq 0 ]; then
        echo -e "${RED}❌ No backup files found${NC}"
        return 1
    fi
    
    return 0
}

# Function to restore from backup
restore_backup() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}❌ Backup file not found: $backup_file${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}🔄 Restoring from backup: $(basename "$backup_file")${NC}"
    echo -e "${RED}⚠️  WARNING: This will completely replace the current database!${NC}"
    
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}❌ Restore cancelled${NC}"
        return 1
    fi
    
    # Create a backup of current state before restore
    echo -e "${BLUE}📦 Creating safety backup of current state...${NC}"
    create_backup "pre_restore_$(date +%Y%m%d_%H%M%S)"
    
    # Drop and recreate database
    echo -e "${YELLOW}🔨 Dropping current database...${NC}"
    export PGPASSWORD="postgres"
    psql -h $DB_HOST -p $DB_PORT -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    
    # Restore from backup
    echo -e "${YELLOW}📥 Restoring from backup...${NC}"
    export PGPASSWORD="postgres"
    psql -h $DB_HOST -p $DB_PORT -U postgres < "$backup_file"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database restored successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Restore failed${NC}"
        return 1
    fi
}

# Function to rollback to clean state (empty database)
rollback_clean() {
    echo -e "${YELLOW}🧹 Rolling back to clean state${NC}"
    echo -e "${RED}⚠️  WARNING: This will remove ALL data and recreate empty database!${NC}"
    
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}❌ Rollback cancelled${NC}"
        return 1
    fi
    
    # Create backup before rollback
    echo -e "${BLUE}📦 Creating backup before clean rollback...${NC}"
    create_backup "before_clean_$(date +%Y%m%d_%H%M%S)"
    
    # Drop and recreate database
    export PGPASSWORD="postgres"
    echo -e "${YELLOW}🔨 Dropping database...${NC}"
    psql -h $DB_HOST -p $DB_PORT -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    
    echo -e "${YELLOW}🔧 Creating clean database...${NC}"
    psql -h $DB_HOST -p $DB_PORT -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    
    echo -e "${GREEN}✅ Clean rollback completed${NC}"
    echo -e "${BLUE}💡 Run './scripts/migrate.sh setup' to restore schema and seed data${NC}"
}

# Function to rollback specific tables only
rollback_tables() {
    local tables="$1"
    
    if [ -z "$tables" ]; then
        echo -e "${RED}❌ No tables specified${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}🗂️  Rolling back tables: $tables${NC}"
    echo -e "${RED}⚠️  WARNING: This will truncate the specified tables!${NC}"
    
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}❌ Rollback cancelled${NC}"
        return 1
    fi
    
    # Create backup before rollback
    echo -e "${BLUE}📦 Creating backup before table rollback...${NC}"
    create_backup "before_table_rollback_$(date +%Y%m%d_%H%M%S)"
    
    export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
    
    # Truncate specified tables
    IFS=',' read -ra TABLE_ARRAY <<< "$tables"
    for table in "${TABLE_ARRAY[@]}"; do
        table=$(echo "$table" | xargs)  # trim whitespace
        echo -e "${YELLOW}🗑️  Truncating table: $table${NC}"
        psql $DATABASE_URL -c "TRUNCATE TABLE \"$table\" RESTART IDENTITY CASCADE;" 2>/dev/null || {
            echo -e "${RED}❌ Failed to truncate table: $table${NC}"
        }
    done
    
    echo -e "${GREEN}✅ Table rollback completed${NC}"
}

# Function to show database status
show_status() {
    echo -e "${YELLOW}📊 Database Status:${NC}"
    
    export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
    
    # Check if database exists and is accessible
    if psql $DATABASE_URL -c "SELECT 1;" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is accessible${NC}"
        
        # Get table counts
        local table_count=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
        echo "  • Tables: $table_count"
        
        # Get record counts for main tables
        if [ "$table_count" -gt "0" ]; then
            echo "  • Record counts:"
            for table in tenants users blockchain_networks dex_protocols arbitrage_configs arbitrage_opportunities arbitrage_executions; do
                local count=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
                echo "    - $table: ${count:-N/A}"
            done
        fi
    else
        echo -e "${RED}❌ Database is not accessible${NC}"
    fi
}

# Main execution
main() {
    ensure_backup_dir
    
    case "${1:-help}" in
        "backup")
            create_backup "${2}"
            ;;
        "list")
            list_backups
            ;;
        "restore")
            if [ -z "$2" ]; then
                echo -e "${YELLOW}📋 Available backups to restore from:${NC}"
                list_backups
                echo ""
                read -p "Enter backup filename (or full path): " backup_input
                if [ -f "$backup_input" ]; then
                    restore_backup "$backup_input"
                elif [ -f "$BACKUP_DIR/$backup_input" ]; then
                    restore_backup "$BACKUP_DIR/$backup_input"
                else
                    echo -e "${RED}❌ Backup file not found${NC}"
                fi
            else
                restore_backup "$2"
            fi
            ;;
        "clean")
            rollback_clean
            ;;
        "tables")
            rollback_tables "$2"
            ;;
        "status")
            show_status
            ;;
        *)
            echo "ArbitrageX Pro 2025 - Database Rollback Tool"
            echo ""
            echo "Usage: $0 {backup|list|restore|clean|tables|status}"
            echo ""
            echo "Commands:"
            echo "  backup [name]     - Create database backup"
            echo "  list              - List available backups"
            echo "  restore [file]    - Restore from backup file"
            echo "  clean             - Rollback to clean state (empty DB)"
            echo "  tables <list>     - Rollback specific tables (comma-separated)"
            echo "  status            - Show database status"
            echo ""
            echo "Examples:"
            echo "  $0 backup production_backup"
            echo "  $0 restore arbitragex_backup_20250903_120000.sql"
            echo "  $0 tables \"arbitrage_opportunities,arbitrage_executions\""
            exit 1
            ;;
    esac
}

main "$@"