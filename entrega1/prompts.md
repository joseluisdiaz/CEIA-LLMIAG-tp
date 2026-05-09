# Prompts

En esta sección se muestran uno a uno los prompts utilizados para generar esta app.

Originalmente intenté con ChatGPT pero despues de iterar dos veces con el canvas que nunca me cargo el editor de código, me fui a usar gemini que lo tengo con subscripción.  

Para ver la secuencia en gemini: [link](https://gemini.google.com/app/ea567dd8a518925a). 

## Secuencia de prompts.

> Vamos a escribir a hacer una pagina html, que tenga css y utlice vanilla javascript. La idea es intentar hacer la peor interface grafica del universo. En particular me gustaría hacer una pagina que permita ingresar en un input box un numero de telefono. Los primeros telefonos usaban un disco numerado: 1, 2, 3, ... 8, 9, 0. Siendo 1 el primero y 0 el ultimo numero. Quisiera que hagamos una pagina donde emule este efecto. Lo que deberiamos primero es tener un circulo grande de un diametro d1 de color negro, que contenga 10 circulos mas pequeños de diametro d2, de color blanco. Cada uno de estos circulos deberia tener un numero adentro de los antes comentados. Estos circulos deberian estar separado 30 grados uno del otro, esto daria un total de 12 circulos pero solo vamos a poner 10. Hagamos el primer intento de dibujar esto en html usando css.

En este primer prompt se intentó iterar con el dibujo básico del disco del teléfono.

> Como lo vamos a usar para llenar un inputbox, vamos a necesitar un elemento del disco para borrar! agreguemos un elemento mas con una flecha del estilo del "delete".

Una vez hecho el disco del teléfono, me di cuenta de que no había forma de borrar los números ingresados.

> Podrias espaciar un poco menos los discos, tal vez hacer un poco mas chicos los circulos con los numero? creo que no hay mucho espacio para que eventualmente roten.

El espacio que teníamos para mover el disco era reducido.

> Por otra parte, queiro que los numeros esten ordenados justo al revez de como estan ordenados ahora.

Preferí otro orden de los discos.

> Necesitamos el fin de carrera para el dedo. El fin de carrera deberia estar debajo del 1.

Faltaba agregar dónde iba a parar el disco.

> Podes volver a regenerar el codigo? quedo solamente un fragmento.

Acá Gemini decidió solo agregar el diff del código y no todo el código.

> Ahora deberiamos hacer que el disco rote en su eje. Tengamos en cuenta:
> - el disco solo gira cuando hacemos click sobre alguno de los numeros.
> - una vez que el circulo llegue al "fin de carrera" no puede avanzar mas.
> - cuando soltamos el click del mouse, el disco vuelve lentamente a su posicion original.

Implementación final usando Javascript.

