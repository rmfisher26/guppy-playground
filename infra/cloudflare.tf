resource "cloudflare_record" "backend" {
  zone_id = var.cloudflare_zone_id
  name    = var.backend_subdomain
  value   = google_cloud_run_domain_mapping.backend.status[0].resource_records[0].rrdata
  type    = google_cloud_run_domain_mapping.backend.status[0].resource_records[0].type
  proxied = false
  ttl     = 300

  depends_on = [google_cloud_run_domain_mapping.backend]
}

resource "cloudflare_record" "frontend" {
  zone_id = var.cloudflare_zone_id
  name    = var.frontend_subdomain
  value   = google_cloud_run_domain_mapping.frontend.status[0].resource_records[0].rrdata
  type    = google_cloud_run_domain_mapping.frontend.status[0].resource_records[0].type
  proxied = false
  ttl     = 300

  depends_on = [google_cloud_run_domain_mapping.frontend]
}
