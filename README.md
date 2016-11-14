# Financiamiento de las Elecciones 2014

Este repositorio aloja la representación gráfica de la red de donaciones que financió a las campañas políticas en las Elecciones Nacionales de Uruguay del año 2014.

# Ejecución

Se recomienda la versión 6.9.1 de node. También se recomienda [yarn](https://yarnpkg.com/), aunque también es válido usar npm.

Primero instalar las dependencias:

```shell
yarn install
```

Para correrlo, ejecutar:

```shell
yarn start
```

Luego abrir el navegador en `http://localhost:8080`.

# Liberación

Para liberar a producción una nueva versión:

```shell
yarn run deploy
```

# Scripts

En la carpeta `scripts` hay algunos scripts ejecutables con [jq](https://stedolan.github.io/jq) para hacer conversiones en archivos JSON. Por ejemplo, para ordenar los nodos por ID y las aristas por destino y luego por origen en un archivo exportado desde Gephi, antes convirtiendo los IDs a número, ejecutar:

```shell
./sort.jq -Mf < entrada.json > salida.json
```

# Licencia

Este código se libera bajo la licencia [Apache 2.0](https://opensource.org/licenses/Apache-2.0).

El favicon viene de [IconArchive](http://www.iconarchive.com/show/sleek-xp-basic-icons-by-hopstarter/Money-icon.html) y no se ha modificado.
