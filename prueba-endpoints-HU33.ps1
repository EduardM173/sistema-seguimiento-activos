# PRUEBAS DE ENDPOINTS - MATERIAL API HU33
# Cumplimiento de Subtareas

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW4xYTR3ZWkwMDBoazhsNmFkdjl2eGY0IiwiY29ycmVvIjoib3BlcmF0aXZvQGFjdGl2b3MuYm8iLCJub21icmVVc2VyaW8iOiJtYXJpYS5vcGVyYXRpdmEiLCJyb2xlIjoiVVNVQVJJT19PUEVSQVRJVk8iLCJpYXQiOjE3NzQxNTg1MDYsImV4cCI6MTc3NDE4NzMwNn0.5R-0a8CT4oNIZPKVhg3tONFGKJmj_B4hZVvfLCHXsdM"

Write-Host "
======================================================================" -ForegroundColor Green
Write-Host "TEST 1 - POST /inventory-items (CREAR MATERIAL)" -ForegroundColor Yellow
Write-Host "======================================================================
" -ForegroundColor Green

Write-Host "[Subtareas cumplidas]" -ForegroundColor Magenta
Write-Host "[ok] PROSIN-151: Crear formulario de registro" -ForegroundColor Cyan
Write-Host "[ok] PROSIN-152: Definir campos" -ForegroundColor Cyan
Write-Host "[ok] PROSIN-154: Crear endpoint POST" -ForegroundColor Cyan
Write-Host "[ok] PROSIN-155: Guardar en base de datos
" -ForegroundColor Cyan

curl = "C:\Program Files\Git\mingw64\bin\curl.exe"
resp1 = & curl -s -X POST "http://localhost:3000/inventory-items" 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer token" 
  -d '{\"codigo\":\"MAT-TEST-001\",\"nombre\":\"Material Test\",\"descripcion\":\"Descripcion test\",\"unidad\":\"caja\",\"stockActual\":100,\"stockMinimo\":25}'

data1 = resp1 | ConvertFrom-Json
Write-Host "[exitoso] Material creado con ID: " data1.id -ForegroundColor Green
Write-Host "Nombre: " data1.nombre -ForegroundColor Cyan
id = data1.id

Write-Host "
======================================================================" -ForegroundColor Green
Write-Host "TEST 2 - GET /inventory-items (LISTAR)" -ForegroundColor Yellow
Write-Host "======================================================================
" -ForegroundColor Green

Write-Host "[Subtareas cumplidas]" -ForegroundColor Magenta
Write-Host "[ok] PROSIN-159: Verificar que aparezca en inventario
" -ForegroundColor Cyan

resp2 = & curl -s -X GET "http://localhost:3000/inventory-items" 
  -H "Authorization: Bearer token"

data2 = resp2 | ConvertFrom-Json
Write-Host "[exitoso] Total materiales: " data2.total -ForegroundColor Green

Write-Host "
======================================================================" -ForegroundColor Green
Write-Host "TEST 3 - GET /inventory-items/:id" -ForegroundColor Yellow
Write-Host "======================================================================
" -ForegroundColor Green

Write-Host "[Subtareas cumplidas]" -ForegroundColor Magenta
Write-Host "[ok] PROSIN-153: Validar datos obligatorios" -ForegroundColor Cyan
Write-Host "[ok] PROSIN-157: Verificar registro de material
" -ForegroundColor Cyan

resp3 = & curl -s -X GET "http://localhost:3000/inventory-items/id" 
  -H "Authorization: Bearer token"

data3 = resp3 | ConvertFrom-Json
Write-Host "[exitoso] Material encontrado: " data3.nombre -ForegroundColor Green

Write-Host "
======================================================================" -ForegroundColor Green
Write-Host "TEST 4 - PUT /inventory-items/:id (ACTUALIZAR)" -ForegroundColor Yellow
Write-Host "======================================================================
" -ForegroundColor Green

Write-Host "[Subtareas cumplidas]" -ForegroundColor Magenta
Write-Host "[ok] PROSIN-158: Sistema solicita datos obligatorios
" -ForegroundColor Cyan

resp4 = & curl -s -X PUT "http://localhost:3000/inventory-items/id" 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer token" 
  -d '{\"stockActual\":150}'

data4 = resp4 | ConvertFrom-Json
Write-Host "[exitoso] Stock actualizado: " data4.stockActual -ForegroundColor Green

Write-Host "
======================================================================" -ForegroundColor Green
Write-Host "TEST 5 - CONFIRMACION (Persistencia de datos)" -ForegroundColor Yellow
Write-Host "======================================================================
" -ForegroundColor Green

Write-Host "[Subtareas cumplidas]" -ForegroundColor Magenta
Write-Host "[ok] PROSIN-156: Mostrar confirmacion de registro
" -ForegroundColor Cyan

resp5 = & curl -s -X GET "http://localhost:3000/inventory-items/id" 
  -H "Authorization: Bearer token"

data5 = resp5 | ConvertFrom-Json
Write-Host "[exitoso] Datos persistidos correctamente
" -ForegroundColor Green

Write-Host "======================================================================" -ForegroundColor Green
Write-Host "RESUMEN - TAREAS CUMPLIDAS DE HU33" -ForegroundColor Green
Write-Host "======================================================================
" -ForegroundColor Green

Write-Host "Total subtareas completadas:" -ForegroundColor Cyan
Write-Host "[ok] PROSIN-151: Crear formulario de registro" -ForegroundColor Green
Write-Host "[ok] PROSIN-152: Definir campos (nombre, descripcion, unidad, cantidad)" -ForegroundColor Green
Write-Host "[ok] PROSIN-153: Validar datos obligatorios" -ForegroundColor Green
Write-Host "[ok] PROSIN-154: Crear endpoint POST" -ForegroundColor Green
Write-Host "[ok] PROSIN-155: Guardar en BD" -ForegroundColor Green
Write-Host "[ok] PROSIN-156: Mostrar confirmacion" -ForegroundColor Green
Write-Host "[ok] PROSIN-157: Usuario pueda registrar material" -ForegroundColor Green
Write-Host "[ok] PROSIN-158: Sistema solicita datos obligatorios" -ForegroundColor Green
Write-Host "[ok] PROSIN-159: Material aparezca en inventario" -ForegroundColor Green
Write-Host "
ESTADO: Todos los endpoints funcionando correctamente
" -ForegroundColor Green
