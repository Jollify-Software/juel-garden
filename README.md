# Juel Garden

A library of custom components written with [Lit](https://lit.dev/) to create 3D and VR scenes with [BabylonJS](https://www.babylonjs.com/).  
This library has been inspired by [A-Frame](https://aframe.io/), but instead of [ThreeJS](https://threejs.org/) we are using Babylon.

## What's in the name

The name 'Garden' was chosen because of the [Hanging Gardens of Babylon](https://en.wikipedia.org/wiki/Hanging_Gardens_of_Babylon), we are using BabylonJS so this seems fitting.  
I am also inspired by [The Village Green Preservation Society](https://youtu.be/lc7dmu4G8oc), the main tutorial [builds a village](https://doc.babylonjs.com/start/chap2).  
God save the village green!

Juel is the Jollify Unique Element Library which is another project I am working on.

# Development

I have developed this library by following the tutorials and taking some examples from the [Babylon Playground](https://www.babylonjs-playground.com/) and creating custom elements based on them.  
Here is the Garden equivalent of the [A-Frame basic scene](https://aframe.io/docs/1.2.0/introduction/):

```html
<garden-scene>
    <garden-camera></garden-camera>
    <garden-light></garden-light>
    
    <garden-element parent position="0 -1 0">
        <garden-box position="-1 0.5 -3" rotation="0 45 0" colour="#4CC3D9"></garden-box>
        <garden-sphere position="0 1.25 -5" diameter="2.50" colour="#EF2D5E"></garden-sphere>
        <garden-cylinder position="1 0.75 -3" diameter="1" height="1.5" colour="#FFC65D"></garden-cylinder>
        <garden-ground position="0 0 -4" width="4" height="4" colour="#7BC8A4"></garden-ground>
    </garden-element>
</garden-scene>
```

The [Waypoints example](https://jollify.app/doc/waypoints.html) shows how this library could be used to create educational VR experiences.  
My favourite example is the [temple example](https://jollify.app/doc/temple.html) which demonstrates how the library could be used to create experiences for museum exhibits:

```html
<garden-scene gravity="0 -0.2 0" collisions>
    <garden-camera type="free" collisions position="0 0 -40"></garden-camera>
    <garden-light></garden-light>

    <garden-room id="r1" collisions></garden-room>
    <garden-opening between="r1 r2" position="0 1 -4" width="2" height="2" depth="0.4"></garden-opening>
    <garden-room id="r2" position="0 0 -8" collisions></garden-room>
    <garden-opening between="r2 s1" position="0 1 -12" width="2" height="2" depth="0.4"></garden-opening>

    <garden-column position="-4 -5 -22" diameter="1" height="6" collisions>
        <garden-particle effect="fire"></garden-particle>
    </garden-column>
    <garden-column position="4 -5 -22" diameter="1" height="6" collisions>
        <garden-particle effect="fire"></garden-particle>
    </garden-column>
    <garden-stairs id="s1" position="0 -5 -32" height="5" depth="20" collisions>
        <garden-sound loop="true" autoplay="true" maxdistance="20"
            url="https://upload.wikimedia.org/wikipedia/commons...Epitaph_of_Seikilos.ogg">
        </garden-sound>
    </garden-stairs>
    <garden-ground width="150" height="160" colour="green" position="0 -5 0" collisions></garden-ground>
</garden-scene>
```

# Contribution

Contribution would be greatly appreciated.  
In order to contribute please open a new issue or a discussion topic and we can talk about it.  
After you have created a issue, you should then fork the project to create your own repo, you can then make changes there.  
Changes should be made on a separate branch, it is a good idea to use prefixes like `feature/...` or `issue/...` when creating your branch.

> Pull requests will not be accepted unless they have a issue for them and reference that issue in the pull request.

I should also say that this is the first Open Source project I have created, so please be patient if I get things wrong.

## What I would like to achieve

* More examples and improvements.
  * The positioning on the basic example is not quite right, the camera needs to be rotated in order to see the scene. `rotation` attribute on camera is not working?
  * The temple example is my favourite but it need some improvement.
    * The rooms really need to touch the ground not be floating in the air. Perhaps we could add a ground level variable?
    * I would like the temple to have more rooms and also a roof, like an Aztec or Greek temple.
* WebXR  and input, I haven't added [WebXR](https://doc.babylonjs.com/divingDeeper/webXR/introToWebXR) to `garden-scene` yet.
  * The user should be able to navigate the temple example in VR. Mouse and keyboard will should be a fallback.
  * Is it better to create a component for WebXR or just add behaviours to `garden-scene`?

