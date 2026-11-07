# SonarQube Cloud

Un proyecto analiza Python (`apps/api`) y TypeScript/React (`apps/web/src`).
Las pruebas se clasifican por separado. Android/iOS y compilados no forman parte
del alcance inicial. Los informes incluyen fuentes sin ejecutar; no se excluye
codigo de aplicacion para aumentar artificialmente la cobertura.

## Configuracion externa (por el propietario)

1. Importar el repositorio en SonarQube Cloud y confirmar el plan y la region.
   Esta configuracion usa la region europea (`https://sonarcloud.io`).
2. Desactivar Automatic Analysis: la cobertura requiere analisis desde CI.
3. En GitHub, configurar las variables de repositorio `SONAR_PROJECT_KEY` y
   `SONAR_ORGANIZATION` con los identificadores exactos del proyecto.
4. Crear el secreto `SONAR_TOKEN` con permiso de analisis sobre ese proyecto.
   Nunca incluir el token en archivos ni mensajes del repositorio.
5. Ejecutar el workflow y verificar que Sonar importe cobertura de ambos lenguajes
   sin advertencias de rutas no resueltas. Revisar tambien la decoracion del PR.
6. Revisar la primera linea base antes de convertir el Quality Gate en check
   obligatorio mediante las protecciones de rama. El scanner no espera el gate
   en esta configuracion inicial; un escaneo exitoso no implica un gate aprobado.

El job `sonar` reutiliza los informes de los dos jobs de pruebas. Los PR de forks
omiten el analisis porque no reciben secretos; las pruebas siguen ejecutandose.
Los fallos de configuracion se muestran explicitamente. No se usa
`pull_request_target`. No se modifican los despliegues ni sus dependencias.

## Verificacion local

Desde la raiz, con las dependencias de desarrollo instaladas:

```powershell
$env:DATABASE_URL = 'sqlite://'
apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests -q --no-header --cov --cov-config=apps/api/.coveragerc --cov-report=term-missing --cov-report=xml:apps/api/coverage.xml --cov-fail-under=80
```

Desde `apps/web`:

```powershell
npm run lint
npm run test:coverage
npm run build
```

El backend conserva el umbral de 80 %, ahora calculado sin contar las propias
pruebas. No se introduce un umbral global de frontend hasta medir su linea base.
Los informes generados se ignoran en Git. La CI usa Python 3.11 y Node 22.

## Entrega para revision

Ejecutar por el propietario desde la raiz, despues de revisar el diff y configurar
SonarQube Cloud. Estos comandos no crean ni fusionan un PR:

```powershell
git diff --check
git diff
git add .github/workflows/README.md .github/workflows/docker-publish.yml .gitignore apps/api/.coveragerc apps/web/package.json apps/web/package-lock.json apps/web/vite.config.ts sonar-project.properties docs/sonarcloud.md
git commit -m "ci: integrate SonarQube Cloud with Python and TypeScript coverage"
git push -u origin chore/sonarcloud
```

Titulo propuesto del PR: `ci: integrar SonarQube Cloud con cobertura de backend y frontend`

Descripcion propuesta:

> Integra el analisis de Python y TypeScript en un unico proyecto de SonarQube
> Cloud. Reutiliza las pruebas existentes de CI, exporta XML y LCOV y transfiere
> ambos informes a un job de analisis. Separa pruebas y fuentes, incluye fuentes
> sin ejecutar y conserva el umbral de cobertura de backend del 80 %.
>
> Requiere SONAR_TOKEN, SONAR_PROJECT_KEY y SONAR_ORGANIZATION en GitHub y
> desactivar Automatic Analysis. Los PR de forks mantienen las pruebas y omiten
> Sonar. El Quality Gate no se configura como bloqueo obligatorio en esta fase.
>
> Validacion local: 171 pruebas de backend aprobadas en Python 3.11.9, con
> 81,71 % de cobertura; 86 pruebas de frontend aprobadas con Node 22, con
> 59,31 % de cobertura de lineas. Lint y build aprobados (ejecutados con Node 26
> local). Lock consistente y rutas de XML/LCOV verificadas. Pendiente el primer
> analisis remoto y la comprobacion de importacion de cobertura en SonarQube Cloud.

La instalacion npm reporto 26 vulnerabilidades (19 moderadas y 7 altas). No se
ejecuto `npm audit fix` ni se atribuyeron al nuevo proveedor de cobertura; su
diagnostico y correccion requieren una revision separada de dependencias.
