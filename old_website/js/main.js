// TODO: This is horribly disorganized.
// There's no clear separation of concerns, let alone model and view.
// Bad Brandon! Bad! Wish I had time to fix this, but there are far
// more exciting projects to work on, and I intend on scrapping 
// this...

var rand = function(a, b) {
	return a + (b - a)*Math.random();
}

var randItem = function(list) {
	return list[Math.floor(rand(0, list.length))];
}

// Based on THREE.js documentation
var generateSprite = function(r, g, b, radius) {
	var canvas = document.createElement('canvas'),
		gradient = null,
		context = null,
		r2 = Math.min(Math.round(r+20), 255),
		g2 = Math.min(Math.round(g+20), 255),
		b2 = Math.min(Math.round(b+20), 255);

	canvas.width = radius;
	canvas.height = radius;

	context = canvas.getContext('2d');
	gradient = context.createRadialGradient(
			canvas.width / 2,
			canvas.height / 2,
			0,
			canvas.width / 2,
			canvas.height / 2,
			canvas.width / 2
	);

	gradient.addColorStop(0, 'rgba('+r2+','+ g2+','+ b2+',1)');
	gradient.addColorStop(0.4, 'rgba('+r+','+g+','+b+',1)');
	gradient.addColorStop(0.8, 'rgba(0,0,0,0)');

	context.fillStyle = gradient;
	context.fillRect(0, 0, canvas.width, canvas.height);

	return canvas;
}

// Atoms have different colors, but they are not the standard colors!
// These have a look and feel to match my site.
// TODO: Make setting colors an API instead of a global.
var sprites = {
	H: generateSprite(255, 255, 255, 40),
	C: generateSprite(99, 0, 0, 50),
	N: generateSprite(187, 187, 187, 55),
	O: generateSprite(204, 0, 0, 60), 
	P: generateSprite(55, 55, 55, 65)
}

var Molecule = function()
{
	var size = 30;
	var spread = 25;

	/**
	 * All of the atoms in the molecule
	 */
	this.atoms = [];

	/**
	 * Atom class.
	 * TODO: Better parameterization: use object w/ named params. 
	 */
	var Atom = function(species, size)
	{
		/**
		 * CTOR
		 */
		var rad = size || 200;

		/**
		 * Object Members
		 */
		this.object = new THREE.Particle(
			new THREE.ParticleBasicMaterial({
				map: new THREE.Texture(sprites[species]),
				blending: THREE.SubtractiveBlending,
		}));

		// TODO: Relative atom position in molecule. 
		// TODO: How to represent this? 
		this.position = {
			x: 0,
			y: 0,
			z: 0
		};

		// XXX: We're doing our own matrix ops
		this.object.matrixAutoUpdate = false;

		// XXX: Don't touch the matrix stack!
		this.matrixStack = [
			this.object.matrix.clone(), // Atom positions
			this.object.matrix.clone(), // Molecule rotation
			this.object.matrix.clone()  // Leaning angle
				.rotateZ(0.625)
		];

		// Add the atom to the scene
		this.add = function(scene) {
			scene.add(this.object);
		}

		/**
		 * Matrix stack operations.
		 */

		this.pushMat = function(mat) {
			this.matrixStack.push(mat);
		}

		this.popMat = function() {
			if(this.matrixStack.length <= 1) {
				return;
			}
			return this.matrixStack.pop();
		}

		this.topMat = function() {
			return this.matrixStack[this.matrixStack.length -1];
		}

		// Set the top matrix (but not root)
		this.setTopMat = function(mat) {
			if(this.matrixStack.length <= 1) {
				return;
			}
			this.matrixStack[this.matrixStack.length - 1] = mat;
		}

		// TODO: Don't multiply by self. Use this first.
		this.applyMats = function() {
			this.object.matrix = new THREE.Matrix4();
			for(var i = this.matrixStack.length - 1; i >= 0; i--) {
				var mat = this.matrixStack[i];
				this.object.matrix.multiplySelf(mat);
			}
		}
	}

	/********************** REST OF CTOR ****************/ 

	// Offsets to make origin dead center (by simple mean)
	var xAvg = -16.637427;
	var yAvg = 4.203991;
	var zAvg = -4.718040741;

	// I'm not being very faithful am I? Suppose it's not
	// even RNA now. All for the sake of artistic interpretation
	for(var i = 0; i < ATOMS.length/4; i++) 
	{
		if(i % 4 == 0) { // dropping every 4 or 5
			//continue;
		}
		if(i % 5 == 0) { // dropping every 4 or 5
			//continue;
		}
		var species = ATOMS[i*4+3];
		if(i < 700) {
			species = randItem(['O', 'C', 'P']);
		}
		else {
			species = randItem(['N', 'H']);
		}
		if(i > 1500) {
			break;
		}
		var atom = new Atom(species);
		atom.add(scene); // TODO: Remove global
		atom.object.updateMatrix();

		// Position and translate entire molecule center
		atom.position.x = ATOMS[i*4] - xAvg;
		atom.position.z = ATOMS[i*4+1] - zAvg;
		atom.position.y = ATOMS[i*4+2] - yAvg;
		this.atoms.push(atom);
	}

	/**
	 * Position blocks in the 'rubik' 3D vector. 
	 */	
	this.position = function(scale)
	{
		var sc = scale || 50;

		for(var i = 0; i < this.atoms.length; i++) {
			var atom = this.atoms[i];
			var coords = {
				x: sc * atom.position.x,
				y: sc * atom.position.y,
				z: sc * atom.position.z
			}
			// Reset root stack matrix to identity, then
			// translate. 
			atom.matrixStack[0]
				.identity()
				.rotateZ(0.42) // XXX: Set the molecule upright
				.translate(coords)
		}
	}

	this.position(spread);

	this.setMat = function(matNo, mat) {
		for(var i = 0; i < this.atoms.length; i++) {
			this.atoms[i].matrixStack[matNo] = mat;
		}
	}

	this.pushMat = function(mat) {
		for(var i = 0; i < this.atoms.length; i++) {
			this.atoms[i].pushMat(mat);
		}
	}

	this.popMat = function() {
		for(var i = 0; i < this.atoms.length; i++) {
			this.atoms[i].popMat();
		}
	}

	/**
	 * Position Blocks
	 * XXX: MUST CALL IN RENDER LOOP. 
	 * TODO: Better (documented) way to send translations to 
	 * render loop
	 */ 
	this.render = function() {
		var atom;
		for(var i = 0; i < this.atoms.length; i++) {
			atom = this.atoms[i];
			atom.object.updateMatrix();
			atom.applyMats();
		}
	}
}

var camera, scene, renderer, clock;
var ambientLight;

var lastX = 0;
var lastY = 0;
var mouseX = 0;
var mouseY = 0;

// Objects
var mol = null;

// TODO: RNA molecule should default to orientation straight upward.
// Simply rotate camera at start. This will also let me get rid of 
// a matrix
function init() 
{
	scene = new THREE.Scene();
	clock = new THREE.Clock();

	var cDom = $(window);
	var aspect = cDom.innerWidth() / cDom.innerHeight();

	camera = new THREE.PerspectiveCamera(
		75,		// fov
		aspect, // aspect
		1,		// near clipping
		10000	// far clipping
	);

	var X_INIT = 700
	var Y_INIT = 0;
	var Z_INIT = 1000; 

	camera.position.x = X_INIT;
	camera.position.y = Y_INIT;
	camera.position.z = Z_INIT;

	scene.add(camera);

	mol = new Molecule();
	
	$(window).mousemove(function(event) {
		lastX = mouseX;
		lastY = mouseY;
		mouseX = event.pageX;
		mouseY = event.pageY;
	});

	renderer = new THREE.CanvasRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);

	$("#canvas").html(renderer.domElement);

	animate();	

	/**
	 * Place the camera according to scroll position.
	 * TODO: Rename, since speed and etc. are affected. 
	 */
	var placeCamera = function() {
		// FIXME: Something is broken about $(document).height
		var height = Math.max(
			$(document).height(),
			$('body').height(),
			$('#main').height(),
			$('#text').height());
		var TOP = 0;
		var BOTTOM = height - $(window).height();

		// Between 0 and 1. 
		var scrollPos = $(document).scrollTop() / BOTTOM;

		var x = X_INIT - Math.round(X_INIT*scrollPos);
		var y = Y_INIT //+ Math.round(100*scrollPos);
		var z = Z_INIT - Math.round(Z_INIT*scrollPos);
		var xRot = 0 - Math.PI/2 * scrollPos;
		var yRot = 0 - Math.PI/10 * scrollPos;
		var zRot = 0 - Math.PI/10 * scrollPos;

		camera.position.x = x;
		camera.position.y = y;
		camera.position.z = z;

		camera.rotation.x = xRot;
		camera.rotation.y = yRot;
		camera.rotation.z = zRot;

		// Rotation speed interpolation
		yAuto = yAutoMax - scrollPos * (yAutoMax - yAutoMin);
	}

	$(window).resize(function() {
		renderer.setSize($(window).width(), 
				$(window).height());

		// FIXME: Best way to replace camera? 
		var aspect = cDom.innerWidth() / cDom.innerHeight();
		camera = new THREE.PerspectiveCamera(
			75,		// fov
			aspect, // aspect
			1,		// near clipping
			10000	// far clipping
		);
		scene.add(camera);
		placeCamera();
	});

	$(window).scroll(function(ev) { placeCamera(); });
}

var rotMat = new THREE.Matrix4();
var yAutoMax = -0.05; // TODO: Cleanup
var yAutoMin = -0.02;
var yAuto = -0.05; // Interpolate between max and min
var yAutoState = 0.0;

/**
 * Render mainloop.
 */
function animate()
{
	requestAnimationFrame(animate);

	// Molecule Auto Rotation
	rotMat.identity()
		.rotateY(yAutoState);

	yAutoState += yAuto;
	yAutoState %= Math.PI*2;

	mol.setMat(1, rotMat);
	mol.render();

	renderer.render(scene, camera);
}

/**
 * Install "items"
 */
var installItems = function(selector, items)
{
	var div = $(selector);
	div.html('');

	for(var i = 0; i < items.length; i++) {
		var pre = items[i];

		var item = $('<div>')
			.addClass('item')
			.append($('<div>')
					.addClass('itemimg')
					.append($('<a>')
						.attr('href', pre.url)
						.html($('<img>')
							.attr('src', pre.img)
						)
					)
			)
			.append($('<div>')
					.addClass('itemdesc')
					.append($('<div>')
						.addClass('itemtitle')
						.append($('<a>')
							.html(pre.title)
							.attr('href', pre.url)
						)
						.append(' ')
						.append($('<span>')
							.addClass('itemdate')
							.html(pre.date)
						)
					)
					.append(pre.descr)
			);

		div.append(item);
	}
}

/**
 * Install Youtube video thumbnail animations and links
 */
var installVideos = function()
{
	var div = $('#videos');
	div.html('');

	var makeUrl = function(id, num) {
		return 'http://img.youtube.com/vi/' + id + '/' + 
			num + '.jpg';
	}

	var setFrame = function(img, frame) {
		var id = $(img).data('id');
		$(img).attr('src', makeUrl(id, frame));
		$(img).data('state', frame);
	}

	var nextFrame = function(img) {
		var state = parseInt($(img).data('state'));
		var next = (state) % 3 + 1;
		setFrame(img, next);
	}

	for(var i = 0; i < VIDEOS.length; i++) {
		var video = VIDEOS[i];

		var img = $('<img src="' + makeUrl(video, 1) + '">')
			.data('state', 1)
			.data('id', video)
			.mouseenter(function() {
				var that = this;
				nextFrame(that);
				$(this).addClass('hover')
					.data('interval', 
						setInterval(function(){ 
							nextFrame(that); }, 600));
			})
			.mouseleave(function() {
				clearInterval($(this).data('interval'));
				setFrame(this, 1);
				$(this).removeClass('hover');
			});

		div.append($('<a href="http://youtube.com/watch?v=' + 
					video + '"></a>')
					.append(img));
	}
}

