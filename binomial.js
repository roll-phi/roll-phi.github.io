
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
    width: ${this.width}px;
    height: ${this.height}px;
    margin: auto;
  }
  svg {
    font: var(--chart-font);
  }
  svg line, svg path {
    stroke: var(--axis-color);
    stroke-width: var(--axis-width);
  }
  svg rect {
    fill: var(--density-color);
  }
  svg rect:hover,
  svg.cumulative rect:hover ~ rect {
    fill: var(--density-highlight);
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
<figure>
  <svg viewBox="0 0 ${this.width} ${this.height}"></svg>
</figure>
`
	this.svg = shadow.querySelector('svg');
	this.triangle = new Array();
    }

    /* Lifecycle */
    
    connectedCallback() {
	this.draw();
	this.svg.addEventListener('mouseover', (e) => {
	    const t = e.target;
	    if (t.classList.contains('density')) {
		const val = t.dataset['x'],
		      x = t.x.animVal.value + t.width.animVal.value / 2,
		      y = t.height.animVal.value,
		      prob = this.cumulative ? t.dataset.cumulative : t.dataset.prob,
		      plate = this.svg.querySelector('.prob');
		plate.setAttribute('transform', `translate(${x}, ${this.plotBase - y})`);
		plate.querySelector('text').textContent = prob + '%';
		plate.classList.remove('hidden');
	    }
	});
	this.svg.addEventListener('mouseout', (e) => {
	    this.svg.querySelector('.prob').classList.add('hidden');
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
	return getComputedStyle(this.svg).getPropertyValue(prop);
    }
    
    /* Geometry */
    get width() {
	return this.getAttribute("width") || 500;
    }
    
    get height() {
	return this.getAttribute("height") || 250;
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
	if (val !== false) {
	    this.setAttribute('cumulative', '');
	    this.svg.classList.add('cumulative');
	} else {
	    this.removeAttribute('cumulative');
	    this.svg.classList.remove('cumulative');
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

	this.svg.innerHTML = `
<g class="plot" transform="matrix(1,0,0,-1,0,${b})">
  <line x1="0" x2="${w}" y1="0" y2="0" />
</g>
<g class="labels"></g>
<g class="prob hidden">
  <text x="0" y="0""></text>
</g>
`;
	const plot = this.svg.querySelector('.plot'),
	      labels = this.svg.querySelector('.labels');
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
