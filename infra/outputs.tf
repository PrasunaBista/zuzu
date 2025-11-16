output "resource_group_name" {
  value = azurerm_resource_group.zuzu.name
}

output "static_web_app_url" {
  value = azurerm_static_web_app.frontend.default_host_name
}

output "function_app_hostname" {
  value = azurerm_linux_function_app.backend.default_hostname
}

output "key_vault_name" {
  value = azurerm_key_vault.zuzu.name
}
