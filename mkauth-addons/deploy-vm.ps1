<#
.SYNOPSIS
  Manda um addon desta pasta para o servidor MK-Auth e instala (php -l + install.sh).

.EXAMPLE
  .\mkauth-addons\deploy-vm.ps1 -ConfigurarChave
      Uma vez só: cria a chave ~/.ssh/mkauth_vm (sem senha, só para a VM) e
      autoriza ela no servidor. Pede a senha do root uma última vez.

.EXAMPLE
  .\mkauth-addons\deploy-vm.ps1
      Instala o split_efi na VM de teste (172.31.255.2).

.EXAMPLE
  .\mkauth-addons\deploy-vm.ps1 -Addon split_efi -Servidor 172.31.255.2 -Usuario root
#>
param(
    [string]$Addon = 'split_efi',
    [string]$Servidor = '172.31.255.2',
    [string]$Usuario = 'root',
    [switch]$ConfigurarChave
)

$ErrorActionPreference = 'Stop'
$destino = "$Usuario@$Servidor"
$pasta = Join-Path $PSScriptRoot $Addon
$chave = Join-Path $env:USERPROFILE '.ssh\mkauth_vm'

# Só pasta de addon desta pasta (evita mandar qualquer coisa por engano).
if ($Addon -notmatch '^[A-Za-z0-9_-]+$' -or -not (Test-Path (Join-Path $pasta 'install.sh'))) {
    throw "Não achei $pasta\install.sh."
}

# Usa a chave própria da VM, se existir; senão o SSH pede a senha.
$sshOpts = @('-o', 'ConnectTimeout=10')
if (Test-Path $chave) {
    $sshOpts += @('-i', $chave, '-o', 'IdentitiesOnly=yes')
}

if ($ConfigurarChave) {
    if (-not (Test-Path $chave)) {
        Write-Host "Criando a chave $chave (sem senha, usada só para este servidor)..."
        ssh-keygen -q -t ed25519 -N '""' -C "deploy-mkauth" -f $chave
        if ($LASTEXITCODE -ne 0) { throw 'ssh-keygen falhou.' }
    }
    $pub = (Get-Content "$chave.pub" -Raw).Trim()
    Write-Host "Autorizando a chave em $destino (vai pedir a senha do $Usuario uma última vez)..."
    if ($pub -notmatch '^ssh-ed25519 [A-Za-z0-9+/=]+ [\w-]+$') { throw 'Chave pública com formato inesperado.' }
    ssh -o ConnectTimeout=10 $destino "umask 077; mkdir -p ~/.ssh; echo '$pub' >> ~/.ssh/authorized_keys; sort -u -o ~/.ssh/authorized_keys ~/.ssh/authorized_keys"
    if ($LASTEXITCODE -ne 0) { throw 'Não consegui autorizar a chave.' }
    ssh -i $chave -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 $destino 'true'
    if ($LASTEXITCODE -ne 0) { throw 'A chave foi enviada, mas o servidor ainda não aceita entrar com ela.' }
    Write-Host 'Pronto: o deploy não vai mais pedir senha.'
    return
}

# Empacota (o tar do Windows existe desde o 10 1803) e manda.
$tgz = Join-Path $env:TEMP "$Addon-deploy.tgz"
tar -czf $tgz -C $PSScriptRoot --exclude='*.md' $Addon
if ($LASTEXITCODE -ne 0) { throw 'tar falhou.' }

$remoto = "/root/$Addon-deploy.tgz"
Write-Host "Enviando $Addon para $destino..."
scp -q @sshOpts $tgz "${destino}:$remoto"
if ($LASTEXITCODE -ne 0) { throw 'scp falhou.' }

# Na VM: extrai numa pasta limpa, confere a sintaxe de todo PHP e instala.
$cmd = @"
set -e
rm -rf /root/$Addon
tar -xzf $remoto -C /root
rm -f $remoto
cd /root/$Addon || { echo 'Pasta /root/$Addon não foi criada'; exit 1; }
[ -f install.sh ] || { echo 'install.sh não veio no pacote:'; ls -la; exit 1; }
erros=0
for f in `$(find . -name '*.php'); do
  php -l "`$f" >/dev/null 2>/tmp/php-l.txt || { echo "Erro de sintaxe em `$f:"; cat /tmp/php-l.txt; erros=1; }
done
[ "`$erros" = 0 ] || { echo 'Nada foi instalado.'; exit 1; }
echo 'Sintaxe ok em todos os PHP.'
sed -i 's/\r`$//' install.sh
sh ./install.sh
"@
Write-Host 'Conferindo e instalando...'
# Vai em base64 como argumento: pela entrada padrão o PowerShell põe BOM e
# quebras de linha do Windows, e o sh do outro lado não entende.
$script = ($cmd -replace "`r", '') + "`n"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
ssh @sshOpts $destino "echo $b64 | base64 -d | sh"
if ($LASTEXITCODE -ne 0) { throw 'A instalação falhou (veja as mensagens acima).' }
Remove-Item $tgz -ErrorAction SilentlyContinue
Write-Host "Instalado. Abra http://$Servidor/admin/addons/$Addon/ (Ctrl+F5)."
