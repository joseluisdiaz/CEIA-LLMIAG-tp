# Prompts

Para generar esta spec, se utilizó el prompt de la [conversación original](https://gemini.google.com/share/521df9e351ba), el cual se detalla a continuación:

```text
Sos un desarrollador backend que está trabajando en un proyecto en el cual usan api-first como principio.

Estan intentando agregar a su api rest un nuevo recurso `todo`. Todo es una entidad que tiene:

- "titulo" que es el titulo de la entrada
- "descripcion" que es un string
- "fecha_limite" que es la fecha limite de ese todo
- "fecha_creacion" que fue cuando ese todo fue creado

necesitamos crear una spec de OpenAPI compatible con 3.1 que use los verbos estandads de rest -

- GET /todos, para listar todos los todos (solo devuelve id y titulo)
- GET /todos/id para obtener un todo en particular (todos los campos)
- POST /todos para crear un todo (titulo es el unico campo requerido)
- PATCH /todos/id para cambiar cualquiera de los campos, menos el id
- DELETE /todos/id para borrar el todo.


el id debe ser un short-uuid

```
