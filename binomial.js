
/**
 * A widget to visualize the binomial distribution
 */
customElements.define("binom-viz", class BinomViz extends HTMLElement {
    static observedAttributes = ["n", "cumulative"];
    
    constructor() {
	super();
	
	const shadow = this.attachShadow({ mode: "open" });
	shadow.innerHTML = `
<style>
  figure {
    margin: 0;
    font: var(--chart-font);
  }
  svg { display: block; }
  svg line, svg path {
    stroke: var(--axis-color);
    stroke-width: var(--axis-width);
  }
  svg rect {
    fill: var(--density-color);
  }
  svg:hover rect {
    fill: var(--density-shaded);
  }
  svg:hover rect:hover,
  .cumulative rect:hover ~ rect {
    fill: var(--density-color);
  }
  svg text {
    text-anchor: middle;
    dominant-baseline: text-before-edge;
  }
  svg .prob text {
    dominant-baseline: text-after-edge;
    font-weight: bold;
    text-shadow: 0 0 2px #fff;
  }
  svg .prob.hidden {
    visibility: hidden;
  }
</style>
<figure></figure>
`
	this.figure = shadow.querySelector('figure');
	this.triangle = new Array();
    }

    /* Lifecycle */
    
    connectedCallback() {
	for (let i = 1; i <= parseInt(this.getAttribute("precompute")); i++)
	    this.pascal(i);
	this.draw();
	this.figure.addEventListener('mouseover', (e) => {
	    const t = e.target;
	    if (t.classList.contains('density')) {
		const val = t.dataset['x'],
		      x = t.x.animVal.value + t.width.animVal.value / 2,
		      y = t.height.animVal.value,
		      prob = this.cumulative ? t.dataset.cumulative : t.dataset.prob,
		      plate = this.figure.querySelector('.prob');
		plate.setAttribute('transform', `translate(${x}, ${this.plotBase - y})`);
		plate.querySelector('text').textContent = prob + '%';
		plate.classList.remove('hidden');
	    }
	});
	this.figure.addEventListener('mouseout', (e) => {
	    this.figure.querySelector('.prob').classList.add('hidden');
	});
    }

    attributeChangedCallback(name, oldValue, newValue) {
	if (oldValue !== newValue) {
	    this[name] = newValue;
	    if (this.isConnected && name == 'n')
		this.draw();
	}
    }

    getStyle(prop) {
	return getComputedStyle(this.figure).getPropertyValue(prop);
    }
    
    /* Geometry */
    get width() {
	return this.clientWidth || 500;
    }
    
    get height() {
	return  this.clientHeight || (this.width / 2);
    }

    get labelHeight() {
	return 2 * parseInt(this.getStyle('font-size').replace('px', ''));
    }
    
    get plotHeight() {
	return this.height - 2*this.labelHeight;
    }
    
    get plotBase() {
	return this.height - this.labelHeight;
    }
    
    /* Dynamic attributes */
    
    get n() {
	return parseInt(this.getAttribute("n")) || 1;
    }
    set n(val) {
	if (parseInt(val) === NaN || val <= 0)
	    throw `Expexting at least 1 die, got ${val}`;
	this.setAttribute("n", val);
    }

    get cumulative() {
	return this.hasAttribute('cumulative');
    }
    set cumulative(val) {
	if (val === false || val === null) {
	    this.removeAttribute('cumulative');
	    this.figure.classList.remove('cumulative');
	} else {
	    this.setAttribute('cumulative', '');
	    this.figure.classList.add('cumulative');
	}
    }
    
    /* Maths */
    
    get die() {
	return parseInt(this.getAttribute("die")) || 2;
    }
    
    pascal(n) {
	if (n < 1)
	    throw `n must be >= 1, got ${n}`;
	if (this.triangle[n] === undefined)
	    if (n == 1) {
		this.triangle[n] = new BigInt64Array((function* (die) {
		    for (let i = 0; i < die; i++)
			yield 1n;
		})(this.die));
	    } else if (n * this.die > 1000) {
		throw `You must be kidding!`
	    } else {
		this.triangle[n] = n < 27
		    ? new BigInt64Array((this.die-1)*n+1)
		    : new Array((this.die-1)*n+1).fill(0n);
		const left = this.pascal(n >> 1),
		      right = this.pascal(n - (n >> 1));
		for (let i = 0; i < left.length; i++)
		    for (let j = 0; j < right.length; j++)
			this.triangle[n][i+j] += left[i] * right[j];
	    }
	return this.triangle[n];
    }
    
    /* Drawing */

    draw() {
	const dist = this.pascal(this.n),
	      w = this.width,
	      h = this.plotHeight,
	      b = this.plotBase,
	      tikz = w / (dist.length + 1),
	      barhw = w / 2.2 / (dist.length + 1),
	      maxprob = parseFloat(dist[dist.length >> 1]),
	      mass = this.die**this.n;

	this.figure.innerHTML = `
<svg viewBox="0 0 ${this.width} ${this.height}">
  <g class="plot" transform="matrix(1,0,0,-1,0,${b})">
    <line x1="0" x2="${w}" y1="0" y2="0" />
  </g>
  <g class="labels"></g>
  <g class="prob hidden">
    <text x="0" y="0""></text>
  </g>
</svg>
`;
	const plot = this.figure.querySelector('.plot'),
	      labels = this.figure.querySelector('.labels');
	let cum = 0;
	for (let i = 0; i < dist.length; i++) {
	    let x = tikz*(i + 1);
	    let prob = parseFloat(dist[i]);
	    plot.innerHTML += `<rect x="${x-barhw}" y="0" width="${2*barhw}" height="${h*prob/maxprob}" class="density" data-x="${i+this.n}" data-prob="${(prob/mass*100).toFixed(2)}" data-cumulative="${((1-cum/mass)*100).toFixed(2)}" />`;
	    if (i % ((dist.length >> 4) + 1) == 0)
		labels.innerHTML += `<text x="${x}" y="${b}">${i + this.n}</text>`;
	    cum += prob;
	}
    }
});
