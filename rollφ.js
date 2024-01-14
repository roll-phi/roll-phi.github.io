/**
 * An object collecting mathematical functions related to the normal
 * distribution
 */
const Normal = {
    // Approximation of erfc from https://dx.doi.org/10.2139/ssrn.4487559
    // according to https://en.wikipedia.org/wiki/Error_function#Numerical_approximations
    erfc : (x) => {
	if (x < 0)
	    return 2 - Normal.erfc(-x);
	if (x >= 30)
	    return 0;
	let res = Math.exp(-x*x) * 0.56418958354775629 / (x + 2.06955023132914151);
	const as = [
	    [2.71078540045147805, 5.80755613130301624, 3.47954057099518960, 12.06166887286239555],
	    [3.47469513777439592, 12.07402036406381411, 3.72068443960225092, 8.44319781003968454],
	    [4.00561509202259545, 9.30596659485887898, 3.90225704029924078, 6.36161630953880464],
	    [5.16722705817812584, 9.12661617673673262, 4.03296893109262491, 5.13578530585681539],
	    [5.95908795446633271, 9.19435612886969243, 4.11240942957450885, 4.48640329523408675],
	];
	for (let a of as)
	    res *= ((x + a[0])*x + a[1]) / ((x + a[2])*x + a[3]);
	return res;
    },
    erf : (x) => 1 - Normal.erfc(x),
    pdf : (x) => Math.exp(-x*x / 2) / Math.sqrt(2 * Math.PI),
    cdf : (x) => Normal.erfc(-x / Math.SQRT2) / 2,
    cdfc : (x) => Normal.erfc(x / Math.SQRT2) / 2,
    probit : (y) => {
	if (y < 0 || y > 1)
	    throw `Probit undefined outside of [0,1], got ${y}`
	if (y == 0)
	    return -Infinity
	if (y == 1)
	    return Infinity
	// Newton iteration
	let x = 0;
	let fx = Normal.cdf(x) - y;
	for (let cnt = 0; Math.abs(fx) > 2.3e-16 && cnt < 40; cnt++) {
	    x -= fx / Normal.pdf(x);
	    fx = Normal.cdf(x) - y;
	} 
	return x;
    },
    test : () => {
	let x = Math.random();
	return x - Normal.cdf(Normal.probit(x));
    }
}

/**
 * A widget to visualize the distribution of dφ
 */
customElements.define("norm-viz", class NormViz extends HTMLElement {
    static observedAttributes = ["σ", "μ", "critical", "left", "right"];
    
    constructor() {
	super();
	
	const shadow = this.attachShadow({ mode: "open" });
	shadow.innerHTML = `
<style>
  div { position: relative; width: ${this.width}px; height: ${this.height}px; }
  canvas { position: absolute; }
  #plot { z-index: 1; }
  #range { z-index: 2; }
  #axes { z-index: 3; }
</style>
<div>
<canvas width="${this.width}" height="${this.height}" id="plot"></canvas>
<canvas width="${this.width}" height="${this.height}" id="range"></canvas>
<canvas width="${this.width}" height="${this.height}" id="axes"></canvas>
</div>
`

	// The background normal curve
	this.plot = shadow.querySelector('#plot').getContext("2d");
	// The axes
	this.axes = shadow.querySelector('#axes').getContext("2d");
	// The measure range
	this.range = shadow.querySelector('#range').getContext("2d");
    }

    /* Lifecycle */
    
    connectedCallback() {
	this.draw_plot();
	this.draw_axes();
	this.draw_range();

	// Activate mouse events
	if (this.hasAttribute("mouse-events")) {
	    const setRange = (x) => {
		if (this.dragging) {
		    this.left = this.c2p(Math.min(this.dragStart, x));
		    this.right = this.c2p(Math.max(this.dragStart, x));
		} else if (!this.dragLock) {
		    this.left = this.c2p(x);
		}
	    };
	    
	    const div = this.shadowRoot.querySelector('div');
	    div.addEventListener('mousedown', (e) => {
		this.dragging = true;
		this.dragLock = false;
		this.dragStart = e.offsetX;
		this.dragTime = Date.now()
	    });
	    div.addEventListener('mouseup', (e) => {
		if (this.dragging) {
		    if (Date.now() - this.dragTime > 200) {
			setRange(e.offsetX);
			this.dragLock = true;
		    } else {
			this.left = -Infinity;
			this.right = Infinity;
			this.dragLock = false;
		    }
		    this.dragging = false;
		}
	    });
	    div.addEventListener('mousemove', (e) => setRange(e.offsetX));
	    div.addEventListener('mouseleave', (e) => {
		if (this.dragging) {
		    setRange(e.offsetX);
		    this.dragging = false;
		    this.dragLock = true;
		} else if (!this.dragLock) {
		    this.left = -Infinity;
		    this.right = Infinity;
		}
	    });
	}
    }

    attributeChangedCallback(name, oldValue, newValue) {
	if (oldValue !== newValue) {
	    this[name] = newValue;
	    this.draw_axes();
	    this.draw_range();
	}
    }

    getStyle(prop) {
	return getComputedStyle(this).getPropertyValue(prop);
    }
    
    /* Geometry */
    get width() {
	return this.getAttribute("width") || 500;
    }
    
    get height() {
	return this.getAttribute("height") || 300;
    }

    get labelHeight() {
	return 2 * parseInt(this.getStyle('font-size').replace('px', ''));
    }
    
    get plotHeight() {
	return this.height - this.labelHeight;
    }

    get maxX() {
	return 4;
    }

    get maxY() {
	return 0.45;
    }

    get pixelX() {
	return 2 * this.maxX / this.width;
    }

    // Transformation from the canvas' frame to the plot's frame
    c2p(x, y=null) {
	const cx = x * this.maxX * 2 / this.width - this.maxX;
	if (y !== null)
	    return [cx, this.maxY - y * this.maxY / this.plotHeight];
	else
	    return cx;
    }

    // Inverse transformation of c2p
    p2c(x, y=null) {
	const cx = x * this.width / 2 / this.maxX + this.width / 2
	if (y !== null)
	    return [cx, this.plotHeight - y * this.plotHeight / this.maxY];
	else
	    return cx;
    }

    // Scale normal variable X to σX+μ
    scale(X) {
	return this.σ * X + this.μ;
    }

    // Unscale normal variable from σX+μ to X
    unscale(X) {
	return (X - this.μ) / this.σ;
    }
    
    /* Dynamic attributes */
    get σ() {
	return parseFloat(this.getAttribute("σ")) || 1;
    }
    set σ(val) {
	if (parseFloat(val) === NaN || val <= 0)
	    throw `StdDev must be positive, got ${val}`;
	this.setAttribute("σ", val);
    }

    get μ() {
	return parseFloat(this.getAttribute("μ")) || 0;
    }
    set μ(val) {
	if (parseFloat(val) === NaN)
	    throw `Mean must be float, got ${val}`;
	this.setAttribute("μ", val);
    }

    get critical() {
	return parseFloat(this.getAttribute("critical")) || 0;
    }
    set critical(val) {
	if (parseFloat(val) === NaN || val < 0 || val > 0.5)
	    throw `Critical boost must be in [0,0.5], got ${val}`;
	this.setAttribute("critical", val);
    }

    get left() {
	const l = parseFloat(this.getAttribute("left"));
	return isNaN(l) ? -Infinity : l;
    }
    set left(val) {
	val = parseFloat(val);
	if (val === NaN)
	    throw `Left must be a float, got ${val}`
	if (val <= -this.maxX)
	    val = -Infinity
	this.setAttribute("left", val);
    }

    get right() {
	const r = parseFloat(this.getAttribute("right"));
	return isNaN(r) ? Infinity : r;
    }
    set right(val) {
	val = parseFloat(val);
	if (val === NaN)
	    throw `Right must be a float, got ${val}`
	if (val >= this.maxX)
	    val = Infinity
	this.setAttribute("right", val);
    }

    /* Computed values */

    get prob() {
	return Normal.cdf(this.right) - Normal.cdf(this.left);
    }
    
    /* Drawing */
    
    draw_plot() {
	this.plot.clearRect(0, 0, this.width, this.height);
	this.plot.fillStyle = this.getStyle('--fill-norm-color');
	this.plot.strokeStyle = this.getStyle('--stroke-norm-color');
	this.plot.lineWidth = this.getStyle('--stroke-norm-width');
	
	this.plot.beginPath();
	this.plot.moveTo(...this.p2c(-this.maxX, Normal.pdf(-this.maxX)));
	for (let x = -this.maxX; x <= this.maxX; x += this.pixelX)
	    this.plot.lineTo(...this.p2c(x, Normal.pdf(x)));
	this.plot.fill();
	this.plot.stroke();
    }

    draw_axes() {
	this.axes.clearRect(0, 0, this.width, this.height);
	this.axes.strokeStyle = this.getStyle('--stroke-axes-color');
	this.axes.lineWidth = this.getStyle('--stroke-axes-width');
	this.axes.fillStyle = this.getStyle('--fill-critical-color');
	this.axes.textAlign = 'center';
	this.axes.textBaseline = 'top';

	// Draw axes
	this.axes.beginPath();
	this.axes.moveTo(...this.p2c(-this.maxX, 0));
	this.axes.lineTo(...this.p2c(this.maxX, 0));
	this.axes.stroke();

	const bits = this.σ >= 1
	      ? Math.floor(Math.log2(this.σ))
	      : -Math.ceil(Math.log2(1/this.σ));
	let incr = Math.pow(2, bits - 3);
	const minX = Math.ceil(this.scale(-this.maxX) / incr),
	      maxX = Math.floor(this.scale(this.maxX) / incr);
	for (let x = minX; x <= maxX; x += 1) {
	    let cx = this.p2c(this.unscale(x*incr));
	    let cls = x % 8;
	    let tick = this.labelHeight / 4 / (1 << (cls & 1) << !!(cls & 3) << !!(cls & 7));
	    this.axes.beginPath();
	    this.axes.moveTo(cx, this.plotHeight);
	    this.axes.lineTo(cx, this.plotHeight + tick);
	    this.axes.stroke();
	    if (cls == 0)
		this.axes.fillText(x*incr, cx, this.plotHeight + tick * 1.1);
	}

	let axX = this.unscale(0);
	axX = this.p2c((axX) > this.maxX
		       ? this.maxX
		       : (axX) < -this.maxX
		       ? -this.maxX
		       : axX);
	this.axes.beginPath();
	this.axes.moveTo(axX, this.plotHeight);
	this.axes.lineTo(axX, 0);
	this.axes.stroke();

	incr = Math.pow(2, -bits - 6);
	const maxY = Math.floor(this.maxY / this.σ / incr);
	for (let y = maxY; y > 0; y -= 1) {
	    let cy = this.p2c(0, y * this.σ * incr)[1];
	    let cls = y % 8;
	    let tick = this.labelHeight / 3 / (1 << (cls & 1) << !!(cls & 3) << !!(cls & 7));
	    this.axes.beginPath();
	    this.axes.moveTo(axX - tick / 2, cy);
	    this.axes.lineTo(axX + tick / 2, cy);
	    this.axes.stroke();
	}

	// Draw critical strips
	if (this.critical) {
	    const x = this.p2c(Normal.probit(this.critical));
	    this.axes.fillRect(0, 0, x, this.height);
	    this.axes.fillRect(this.width - x, 0, x, this.height);
	}
    }

    draw_range(e) {
	this.range.clearRect(0, 0, this.width, this.height);
	this.range.fillStyle = this.getStyle('--fail-mask-color');
	this.range.strokeStyle = this.getStyle('--target-line-color');
	this.range.textBaseline = 'bottom';
	this.range.textAlign = 'center';

	if (this.left > -Infinity) {
	    const x = this.p2c(this.left);
	    this.range.fillRect(0, 0, x, this.height);
	    this.range.beginPath()
	    this.range.moveTo(x, 0);
	    this.range.lineTo(x, this.height - this.labelHeight / 2.5);
	    this.range.stroke();
	    
	    this.range.save();
	    this.range.fillStyle = this.getStyle('--target-line-color');
	    this.range.fillText(this.scale(this.left).toFixed(3), x, this.height);
	    this.range.restore();
	}

	if (this.right < Infinity) {
	    const x = this.p2c(this.right);
	    this.range.fillRect(x, 0, this.width - x, this.height);
	    this.range.beginPath()
	    this.range.moveTo(x, 0);
	    this.range.lineTo(x, this.height - this.labelHeight / 2.5);
	    this.range.stroke();
	    
	    this.range.save();
	    this.range.fillStyle = this.getStyle('--target-line-color');
	    this.range.fillText(this.scale(this.right).toFixed(3), x, this.height);
	    this.range.restore();
	}

	if (this.getStyle('--range-prob-color') &&
	    (this.left > -Infinity || this.right < Infinity)) {
	    this.range.save();
	    this.range.strokeStyle = this.getStyle('--range-prob-color');
	    this.range.font = this.getStyle('--range-prob-font');
	    const prob = (this.prob * 100).toFixed(1) + '%';
	    const x = 0; //(Math.max(-this.maxX, this.left) + Math.min(this.maxX, this.right)) / 2;
	    this.range.strokeText(prob, this.p2c(x), this.plotHeight * 0.95);
	    this.range.restore();
	}
    }
});



/*
  let peer = new Peer();
      let $ = document.querySelector.bind(document);

      peer.on('open', (id) => {
	  let params = new URLSearchParams(location.search);
	  if (params.has('join')) {
	      // player mode
	      let conn = peer.connect(params.get('join'));
	      console.log("Connected to", conn.peer);
	      conn.on('open', () => conn.send(`Hi, I'm ${id}`));
	  } else {
	      // gm mode
	      let url = new URL(location);
	      url.searchParams.set('join', id);
	      $('#join-url').textContent = url.href;
	  }
      });

      peer.on('connection', (conn) => {
	  console.log("Connection from", conn.peer);
	  conn.on('error', (err) => {
	      console.log(conn.peer, "error:", err);
	  });
	  conn.on('data', (data) => {
	      console.log(conn.peer, data);
	  });
      });
*/
