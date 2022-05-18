import * as THREE from "https://cdn.skypack.dev/three@0.129.0";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { mockData } from './mockData.js';
import { HTMLMesh } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/interactive/HTMLMesh.js";

let scene, camera, renderer, raycaster, mouse, earth, earthPivot, cameraControl, selectedObject;
let points = [];
let earthMoving = true;
const EARTH_RADIUS = 5;
const DEG = Math.PI/180;
const MIN_CAMERA_Z = 6.5;
const MAX_CAMERA_Z = 20;
const FLUID_PLACEMENT_MODE = true;

init();
animate();

function init()
{			
	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.z = MAX_CAMERA_Z;

	renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );

    cameraControl = new OrbitControls(camera, renderer.domElement);
    cameraControl.enableDamping = true;
    cameraControl.minDistance = MIN_CAMERA_Z;
    cameraControl.maxDistance = MAX_CAMERA_Z;
    
    mouse = new THREE.Vector2()

    raycaster = new THREE.Raycaster();
	
	var geometry = new THREE.SphereGeometry(EARTH_RADIUS, 32, 32);
	var material = new THREE.MeshPhongMaterial({
        map         : new THREE.TextureLoader().load('images/earth-equirectangular-4k.jpg'), //add earth plane image
       //bumpMap     : new THREE.TextureLoader().load('images/earthbump1k.jpg'), //add bump map (mappa a rilievo) of the earth plane image
        bumpScale   : 0.05,
        //specularMap : new THREE.TextureLoader().load('images/earthspec1k.jpg'), //add a specular texture for changing the 'shininess' of the object with a texture
        specular    : new THREE.Color('grey')
    });
    earth = new THREE.Mesh(geometry, material)
    earthPivot = new THREE.Group();
    earthPivot.add(earth);
    scene.add(earthPivot);

    let light = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(light);
    light = new THREE.SpotLight(0xffffff, 0.8);
    light.position.x = 100;
    scene.add(light);

    mockData.points.map(point => addPoint(point));         
}

function addPoint(point) {
    const geometry = new THREE.ConeGeometry( 0.1, 0.4, 16 );
    const pointPivot = new THREE.Group();
    const pointMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));

    const detailsMesh = createDetailsContent(point);
    let detailsObject = new HTMLMesh(detailsMesh);
    detailsObject.scale.setScalar(10);
    detailsObject.visible = false;

    pointMesh.rotation.x = -90 * DEG;
    pointMesh.pointData = {
        id: point.id,
        title: point.title,
        subtitle: point.subtitle,
        details: detailsObject
    };
    pointPivot.add(pointMesh);
    pointPivot.add(detailsObject);
    pointMesh.position.z = EARTH_RADIUS;
    detailsObject.position.z = EARTH_RADIUS + 0.1;
    pointPivot.rotation.y = point.longitude * DEG;
    pointPivot.rotation.x = point.latitude * DEG;
    points.push(pointPivot);
    earthPivot.add(pointPivot);
}

function createDetailsContent(point) {
    const container = document.createElement("div");
    container.classList.add("point-details-container");

    const title = document.createElement("h2");
    title.innerText = point.title;
    title.classList.add("point-details-title");

    const text = document.createElement("p");
    text.innerText = point.subtitle;
    text.classList.add("point-details-text");

    container.appendChild(title);
    container.appendChild(text);
    container.style.visibility = "hidden";
    container.style.position = "fixed";

    document.body.appendChild(container);

    return container;
}

function animate()
{
    requestAnimationFrame( animate );

    if (earthMoving)
        earthPivot.rotation.y += 0.001;
        
    cameraControl.update();
	renderer.render( scene, camera );
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

document.body.addEventListener("mousemove", onMouseMove);
document.body.addEventListener("click", onClick);

function onClick() {
    if (selectedObject && selectedObject.pointData) console.log(selectedObject.pointData);
}

function onMouseMove(event) {
    event.preventDefault();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
  
    let intersects = raycaster.intersectObject(scene, true);
  
    if (intersects.length > 0) { 
        const previousSelected = selectedObject;
        selectedObject = intersects[0].object;
        if (selectedObject.pointData) {
            if (!previousSelected) {
                selectedObject.visible = false;
                selectedObject.pointData.details.visible = true;
            }
        } else {
            if (previousSelected) {
                previousSelected.visible = true;
                previousSelected.pointData.details.visible = false;
            }
            selectedObject = undefined;
        }
    }
      
    renderer.render(scene, camera);
}

document.getElementById("activate-xr").addEventListener("click", activateXR);

async function activateXR() {
    // Add a canvas element and initialize a WebGL context that is compatible with WebXR.
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const gl = canvas.getContext("webgl", { xrCompatible: true });

    const ARScene = new THREE.Scene();

    const light = new THREE.AmbientLight(0xeeeeee);
    ARScene.add(light);

    // Set up the WebGLRenderer, which handles rendering to the session's base layer.
    const ARrenderer = new THREE.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true,
      canvas: canvas,
      context: gl
    });
    ARrenderer.autoClear = false;

    // The API directly updates the camera matrices.
    // Disable matrix auto updates so three.js doesn't attempt
    // to handle the matrices independently.
    const ARcamera = new THREE.PerspectiveCamera();
    ARcamera.matrixAutoUpdate = false;

    // Initialize a WebXR session using "immersive-ar".
    const session = await navigator.xr.requestSession("immersive-ar", { requiredFeatures: ['hit-test'] });
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    const referenceSpace = await session.requestReferenceSpace('local');
    // Create another XRReferenceSpace that has the viewer as the origin.
    const viewerSpace = await session.requestReferenceSpace('viewer');
    // Perform hit testing using the viewer as origin.
    const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

    const loader = new GLTFLoader();
    let reticle;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", function (gltf) {
      reticle = gltf.scene;
      reticle.visible = false;
      ARScene.add(reticle);
    });

    let ARearth = earth.clone();
    ARearth.scale.set(0.02, 0.02, 0.02);
    let objectPlaced = false;

    session.addEventListener("select", (event) => {
        if (!objectPlaced || FLUID_PLACEMENT_MODE) { 
          ARearth.position.copy(reticle.position);
          ARearth.position.y += 0.2;
          if (!objectPlaced)
            ARscene.add(ARearth);
          objectPlaced = true;
          reticle.visible = FLUID_PLACEMENT_MODE;
        }
      });

    // Create a render loop that allows us to draw on the AR view.
    const onXRFrame = (time, frame) => {
      // Queue up the next draw request.
      session.requestAnimationFrame(onXRFrame);
      // Bind the graphics framebuffer to the baseLayer's framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer)

      const pose = frame.getViewerPose(referenceSpace);
      if (pose) {
            const pose = frame.getViewerPose(referenceSpace);
            if (pose) {
                // In mobile AR, we only have one view.
                const view = pose.views[0];

                const viewport = session.renderState.baseLayer.getViewport(view);
                ARrenderer.setSize(viewport.width, viewport.height)

                // Use the view's transform matrix and projection matrix to configure the THREE.camera.
                ARcamera.matrix.fromArray(view.transform.matrix)
                ARcamera.projectionMatrix.fromArray(view.projectionMatrix);
                ARcamera.updateMatrixWorld(true);

                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length > 0 && reticle) {
                    const hitPose = hitTestResults[0].getPose(referenceSpace);
                    reticle.visible = !objectPlaced || FLUID_PLACEMENT_MODE;
                    reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z)
                    reticle.updateMatrixWorld(true);
                }
            }
        }

        if (ARearth && earthMoving)
            ARearth.rotation.y += 0.001

        ARrenderer.render(ARscene, ARcamera)
    }
    session.requestAnimationFrame(onXRFrame);
}