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

mkdir -p "$DESTINO/provedores"
for f in index.php lib.php retorno.php cron.php manifest.json .htaccess; do
  cp "$ORIGEM/$f" "$DESTINO/$f"
done
cp "$ORIGEM"/provedores/*.php "$DESTINO/provedores/"
printf 'Require all denied\n' > "$DESTINO/provedores/.htaccess"

# O addons.class.php é do MK-Auth (confere o login do painel). O próprio
# MK-Auth (scripts/addons.php, a cada 5 min) mantém em cada addon um link para
# include/addons.inc.hhvm; fazemos o mesmo link para não esperar a rodada.
CLASSE=/opt/mk-auth/include/addons.inc.hhvm
[ -f "$CLASSE" ] || { echo "Não achei $CLASSE (MK-Auth sem suporte a addons?)."; exit 1; }
ln -sfn "$CLASSE" "$DESTINO/addons.class.php"

# Permissões só nos arquivos do addon: nunca seguir links, senão o chmod
# atinge o addons.inc.hhvm do MK-Auth e derruba todos os addons.
chown -R -h www-data:www-data "$DESTINO"
find "$DESTINO" -type f -name '*.php' -exec chmod 640 {} +
chmod 644 "$CLASSE" 2>/dev/null || true

# Item no menu Provedor. Sempre reescreve a linha (tira a antiga e põe a atual),
# para uma reinstalação levar mudanças de texto/ícone. picone = classe do ícone
# (Bootstrap Icons e Font Awesome 4 já vêm no painel).
sed -i '/^\/\/ SPLIT EFI$/d; /addons\/split_efi\//d' "$ADDONS/addon.js"
sed -i -e :a -e '/^\n*$/{$d;N;ba' -e '}' "$ADDONS/addon.js"   # tira linhas em branco do fim
cat >> "$ADDONS/addon.js" <<'EOF'

// SPLIT EFI
add_menu.provedor('{"plink": "' + window.location.protocol + '//' + window.location.host + '/admin/addons/split_efi/", "ptext": "Split Efi", "picone": "bi bi-cash-coin"}');
EOF

# Agendamento: de 5 em 5 minutos.
cat > /etc/cron.d/split_efi <<'EOF'
# Addon SPLIT EFI: registra os títulos do split na Efí e acompanha mudanças.
*/5 * * * *   root   /usr/bin/php /opt/mk-auth/admin/addons/split_efi/cron.php >> /var/log/split_efi.log 2>&1
EOF
chmod 644 /etc/cron.d/split_efi

# Cria as tabelas agora (o cron também cria, se faltar).
/usr/bin/php -r 'set_include_path(".:/opt/mk-auth/include"); require "/opt/mk-auth/admin/addons/split_efi/lib.php"; garantir_tabelas(); echo "Tabelas ok\n";'

echo "Instalado em $DESTINO. Limpe o cache do navegador e abra Provedor > Split Efí."
