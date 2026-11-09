#!/bin/sh
# Instala o addon SPLIT EFI no servidor do MK-Auth. Rodar como root, de dentro
# desta pasta:  sh install.sh
# Não ativa o split: isso é feito no painel (Provedor > Split Efí > Ativar).
set -e

DESTINO=/opt/mk-auth/admin/addons/split_efi
ADDONS=/opt/mk-auth/admin/addons
ORIGEM=$(cd "$(dirname "$0")" && pwd)

[ "$(id -u)" = "0" ] || { echo "Rode como root."; exit 1; }
[ -d "$ADDONS" ] || { echo "Não achei $ADDONS. Isto é um servidor MK-Auth?"; exit 1; }

mkdir -p "$DESTINO"
for f in index.php lib.php retorno.php cron.php manifest.json .htaccess; do
  cp "$ORIGEM/$f" "$DESTINO/$f"
done

# O addons.class.php é do MK-Auth (confere o login do painel). Cada addon leva
# uma cópia; pegamos a de outro addon já instalado.
if [ ! -f "$DESTINO/addons.class.php" ]; then
  CLASSE=$(find "$ADDONS" -maxdepth 2 -name addons.class.php ! -path "$DESTINO/*" | head -1)
  [ -n "$CLASSE" ] || { echo "Não achei addons.class.php em nenhum addon de $ADDONS."; exit 1; }
  cp "$CLASSE" "$DESTINO/addons.class.php"
fi

chown -R www-data:www-data "$DESTINO"
chmod 640 "$DESTINO"/*.php

# Item no menu Provedor.
if ! grep -q 'addons/split_efi/' "$ADDONS/addon.js"; then
  cat >> "$ADDONS/addon.js" <<'EOF'

// SPLIT EFI
add_menu.provedor('{"plink": "' + window.location.protocol + '//' + window.location.host + '/admin/addons/split_efi/", "ptext": "Split Efi"}');
EOF
fi

# Agendamento: de 5 em 5 minutos.
cat > /etc/cron.d/split_efi <<'EOF'
# Addon SPLIT EFI: registra os títulos do split na Efí e acompanha mudanças.
*/5 * * * *   root   /usr/bin/php /opt/mk-auth/admin/addons/split_efi/cron.php >> /var/log/split_efi.log 2>&1
EOF
chmod 644 /etc/cron.d/split_efi

# Cria as tabelas agora (o cron também cria, se faltar).
/usr/bin/php -r 'set_include_path(".:/opt/mk-auth/include"); require "/opt/mk-auth/admin/addons/split_efi/lib.php"; garantir_tabelas(); echo "Tabelas ok\n";'

echo "Instalado em $DESTINO. Limpe o cache do navegador e abra Provedor > Split Efí."
