# ArbitrageX Supreme - HashiCorp Vault Configuration
# Ingenio Pichichi S.A. - Gestión empresarial de secretos
# TODO FUNCIONAL - Sin hardcoded secrets

# Configuración de almacenamiento
storage "file" {
  path = "/opt/vault/data"
}

# Configuración de listener para desarrollo/staging
listener "tcp" {
  address     = "127.0.0.1:8200"
  tls_disable = 1
}

# Configuración de listener para producción (con TLS)
listener "tcp" {
  address         = "0.0.0.0:8200"
  tls_cert_file   = "/opt/vault/tls/vault.crt"
  tls_key_file    = "/opt/vault/tls/vault.key"
  tls_disable     = 0
}

# Configuración de API
api_addr = "http://127.0.0.1:8200"
cluster_addr = "https://127.0.0.1:8201"

# Configuración de UI web
ui = true

# Configuración de logging
log_level = "INFO"
log_file = "/opt/vault/logs/vault.log"

# Configuración de telemetría (opcional)
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname = true
}

# Configuración de plugins
plugin_directory = "/opt/vault/plugins"

# Configuración de rendimiento
max_lease_ttl = "768h"
default_lease_ttl = "768h"

# Configuración de sello automático (Auto-unseal) para producción
# Comentado para desarrollo local
# seal "awskms" {
#   region     = "us-east-1"
#   kms_key_id = "alias/vault-unseal-key"
# }

# Configuración de políticas predeterminadas
disable_mlock = true