# ArbitrageX Supreme - Vault Security Policy
# Ingenio Pichichi S.A. - Políticas de acceso granular

# Política para secretos de blockchain
path "secret/data/blockchain/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Política para API keys externos
path "secret/data/api-keys/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Política para configuración de base de datos
path "secret/data/database/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Política para configuración MEV
path "secret/data/mev/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Política para JWT y encryption keys
path "secret/data/security/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Política para webhooks
path "secret/data/webhooks/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Acceso a metadata
path "secret/metadata/*" {
  capabilities = ["list"]
}

# Política para rotación de secrets
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "auth/token/revoke-self" {
  capabilities = ["update"]
}

# Política para auditoría
path "sys/audit" {
  capabilities = ["read", "list"]
}

# Política para health checks
path "sys/health" {
  capabilities = ["read"]
}