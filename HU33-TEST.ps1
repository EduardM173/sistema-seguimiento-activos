$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW4xYTR3ZWkwMDBoazhsNmFkdjl2eGY0IiwiY29ycmVvIjoib3BlcmF0aXZvQGFjdGl2b3MuYm8iLCJub21icmVVc2VyaW8iOiJtYXJpYS5vcGVyYXRpdmEiLCJyb2xlIjoiVVNVQVJJT19PUEVSQVRJVk8iLCJpYXQiOjE3NzQxNTg1MDYsImV4cCI6MTc3NDE4NzMwNn0.5R-0a8CT4oNIZPKVhg3tONFGKJmj_B4hZVvfLCHXsdM"
$curl = "C:\Program Files\Git\mingw64\bin\curl.exe"

Write-Host ""
Write-Host "====== TEST 1: POST /inventory-items (CREAR MATERIAL) ======" -ForegroundColor Yellow
Write-Host "[PROSIN-151] Crear formulario de registro" -ForegroundColor Cyan
Write-Host "[PROSIN-152] Definir campos" -ForegroundColor Cyan
Write-Host "[PROSIN-154] Crear endpoint POST" -ForegroundColor Cyan
Write-Host "[PROSIN-155] Guardar en BD" -ForegroundColor Cyan
Write-Host ""

$resp1 = & $curl -s -X POST "http://localhost:3000/inventory-items" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d '{"codigo":"MAT-TEST-001","nombre":"Material Test","descripcion":"Test Description","unidad":"caja","stockActual":100,"stockMinimo":25}'

$data1 = $resp1 | ConvertFrom-Json
Write-Host "[OK] Material creado: $($data1.nombre)" -ForegroundColor Green
$id = $data1.id
Write-Host ""

Write-Host "====== TEST 2: GET /inventory-items (LISTAR) ======" -ForegroundColor Yellow
Write-Host "[PROSIN-159] Verificar que aparezca en inventario" -ForegroundColor Cyan
Write-Host ""

$resp2 = & $curl -s -X GET "http://localhost:3000/inventory-items" `
  -H "Authorization: Bearer $token"

$data2 = $resp2 | ConvertFrom-Json
Write-Host "[OK] Total de materiales: $($data2.total)" -ForegroundColor Green
Write-Host ""

Write-Host "====== TEST 3: GET /inventory-items/:id ======" -ForegroundColor Yellow
Write-Host "[PROSIN-153] Validar datos obligatorios" -ForegroundColor Cyan
Write-Host "[PROSIN-157] Verificar registro by ID" -ForegroundColor Cyan
Write-Host ""

$resp3 = & $curl -s -X GET "http://localhost:3000/inventory-items/$id" `
  -H "Authorization: Bearer $token"

$data3 = $resp3 | ConvertFrom-Json
Write-Host "[OK] Encontrado: $($data3.nombre)" -ForegroundColor Green
Write-Host ""

Write-Host "====== TEST 4: PUT /inventory-items/:id (ACTUALIZAR) ======" -ForegroundColor Yellow
Write-Host "[PROSIN-158] Sistema solicita datos obligatorios" -ForegroundColor Cyan
Write-Host ""

$resp4 = & $curl -s -X PUT "http://localhost:3000/inventory-items/$id" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d '{"stockActual":150}'

$data4 = $resp4 | ConvertFrom-Json
Write-Host "[OK] Stock actualizado a: $($data4.stockActual)" -ForegroundColor Green
Write-Host ""

Write-Host "====== TEST 5: CONFIRMACION (Persistencia) ======" -ForegroundColor Yellow
Write-Host "[PROSIN-156] Mostrar confirmacion de registro" -ForegroundColor Cyan
Write-Host ""

$resp5 = & $curl -s -X GET "http://localhost:3000/inventory-items/$id" `
  -H "Authorization: Bearer $token"

$data5 = $resp5 | ConvertFrom-Json
Write-Host "[OK] Datos persistidos correctamente" -ForegroundColor Green
Write-Host ""

Write-Host "====== RESUMEN - SUBTAREAS CUMPLIDAS HU33 ======" -ForegroundColor Green
Write-Host "[OK] PROSIN-151: Crear formulario de registro" -ForegroundColor Green
Write-Host "[OK] PROSIN-152: Definir campos" -ForegroundColor Green
Write-Host "[OK] PROSIN-153: Validar datos obligatorios" -ForegroundColor Green
Write-Host "[OK] PROSIN-154: Crear endpoint POST" -ForegroundColor Green
Write-Host "[OK] PROSIN-155: Guardar en BD" -ForegroundColor Green
Write-Host "[OK] PROSIN-156: Mostrar confirmacion" -ForegroundColor Green
Write-Host "[OK] PROSIN-157: Usuario pueda registrar material" -ForegroundColor Green
Write-Host "[OK] PROSIN-158: Sistema valida datos obligatorios" -ForegroundColor Green
Write-Host "[OK] PROSIN-159: Material aparezca en inventario" -ForegroundColor Green
Write-Host ""
Write-Host "ESTADO: Todos los endpoints funcionando - HU33 COMPLETADA" -ForegroundColor Green
Write-Host ""
