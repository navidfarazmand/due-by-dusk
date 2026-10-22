# Models

Both packs here are by Quaternius and released under CC0 1.0 (public domain). They are free for commercial use and need no credit, although crediting Quaternius is a nice gesture.

## quaternius-nature-crops

Nature Crops Pack (January 2020). 102 low-poly FBX models of crops, plants and trees. Most crops come in growth stages `_1` to `_4` plus a ripe `_Crop` model, and several also have a `_Harvested` model.

Useful for this game: `Carrot`, `Lettuce` (as cabbage), `Pumpkin`, `Beet` (as the runaway radish), `Corn` (as golden corn), `Wheat`, `Tomato`, `Watermelon`. `Preview.png` shows the whole pack.

Source: https://opengameart.org/content/lowpoly-crops-pack

## quaternius-farm-animals

Farm Animals Pack. Seven rigged FBX animals: Cow, Horse, Llama, Pig, Pug, Sheep, Zebra.

- Cow, Horse and Zebra have the animations Idle, Walk, WalkSlow, Run, Jump and Death.
- Pig, Sheep, Llama and Pug have Idle and Jump.

`Preview.gif` shows them, and `License.txt` is the original license note.

Source: https://opengameart.org/content/lowpoly-animated-farm-animal-pack

## Using them in the 3D game

three.js can load FBX files with `FBXLoader`, including the animations, which play through `AnimationMixer`. For smaller and faster files, convert them to GLB in Blender (File > Export > glTF 2.0) and load them with `GLTFLoader`.

The original downloads also contain OBJ and Blender (`.blend`) copies of the same models. They were left out to keep this repo small. Get them from the source links above if needed.

## Not included

- **Low Poly Farm V2** by EdwiixGG on Sketchfab: https://sketchfab.com/3d-models/low-poly-farm-v2-0e91a96ca6ee44569cf94972e30b5be4. A free farm scene (barn, tractor, animals, crops), about 48.8k triangles, with no animations. Downloading it needs a Sketchfab account. Its license is CC BY 4.0, so a game that uses it must credit EdwiixGG.
- **LowPoly Farm Buildings** by Quaternius: https://quaternius.itch.io/lowpoly-farm-buildings. 13 farm buildings, CC0, pay what you want (free is allowed).
