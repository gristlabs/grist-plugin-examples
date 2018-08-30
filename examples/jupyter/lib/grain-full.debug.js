(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.grainjs = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
var computed_1 = require("./lib/computed");
exports.Computed = computed_1.Computed;
exports.computed = computed_1.computed;
__export(require("./lib/dispose"));
__export(require("./lib/dom"));
__export(require("./lib/emit"));
__export(require("./lib/kowrap"));
__export(require("./lib/obsArray"));
__export(require("./lib/observable"));
__export(require("./lib/styled"));
var subscribe_1 = require("./lib/subscribe");
exports.Subscription = subscribe_1.Subscription;
exports.subscribe = subscribe_1.subscribe;
__export(require("./lib/util"));
__export(require("./lib/widgets/input"));
__export(require("./lib/widgets/select"));

},{"./lib/computed":11,"./lib/dispose":12,"./lib/dom":13,"./lib/emit":15,"./lib/kowrap":16,"./lib/obsArray":17,"./lib/observable":18,"./lib/styled":19,"./lib/subscribe":20,"./lib/util":21,"./lib/widgets/input":22,"./lib/widgets/select":23}],2:[function(require,module,exports){
"use strict";
/**
 * A simple and fast priority queue with a limited interface to push, pop, peek, and get size. It
 * is essentially equivalent to both npm modules 'fastpriorityqueue' and 'qheap', but is in
 * TypeScript and is a bit cleaner and simpler.
 *
 * It is constructed with a function that returns which of two items is "prior"; the pop() method
 * returns the most-prior element.
 */
Object.defineProperty(exports, "__esModule", { value: true });
class PriorityQueue {
    constructor(_isPrior) {
        this._isPrior = _isPrior;
        // Items form a binary tree packed into an array. Root is items[0]; children of items[i] are
        // items[2*i+1] and items[2*i+2]; parent of items[i] is items[(i - 1) >> 1]. For all children,
        // the invariant isPrior(parent, child) holds.
        this._items = [];
    }
    get size() { return this._items.length; }
    push(item) {
        const items = this._items;
        const isPrior = this._isPrior;
        let curIdx = this._items.length;
        while (curIdx > 0) {
            // While we have a parent that is not prior to us, bubble up the "hole" at items.length.
            const parIdx = (curIdx - 1) >> 1; // tslint:disable-line:no-bitwise
            const parItem = items[parIdx];
            if (isPrior(parItem, item)) {
                break;
            }
            items[curIdx] = parItem;
            curIdx = parIdx;
        }
        items[curIdx] = item;
    }
    peek() {
        return this._items[0];
    }
    pop() {
        if (this._items.length <= 1) {
            return this._items.pop();
        }
        const items = this._items;
        const isPrior = this._isPrior;
        const result = items[0];
        // Bubble the last item downwards from the root.
        const item = items.pop();
        const size = this._items.length;
        let curIdx = 0;
        let leftIdx = 1;
        while (leftIdx < size) {
            const rightIdx = leftIdx + 1;
            const bestIdx = (rightIdx < size && isPrior(items[rightIdx], items[leftIdx])) ?
                rightIdx : leftIdx;
            if (isPrior(item, items[bestIdx])) {
                break;
            }
            items[curIdx] = items[bestIdx];
            curIdx = bestIdx;
            leftIdx = curIdx + curIdx + 1;
        }
        items[curIdx] = item;
        return result;
    }
}
exports.PriorityQueue = PriorityQueue;

},{}],3:[function(require,module,exports){
"use strict";
/**
 * This module supports computed observables, organizing them into a priority queue, so that
 * computeds can be updated just once after multiple bundled changes.
 *
 * This module is for internal use only (hence the leading underscore in the name). The only
 * function useful outside is exposed via the `observable` module as `observable.bundleChanges()`.
 *
 * Changes may come together because multiple observables are changed synchronously, or because
 * multiple computeds depend on a single changed observable. In either case, if a computed depends
 * on multiple observables that are being changed, we want it to just get updated once when the
 * changes are complete.
 *
 * This is done by maintaining a _priority in each computed, where greater values get evaluated
 * later (computed with greater values depend on those with smaller values). When a computed needs
 * updating, it adds itself to the queue using enqueue() method. At the end of an observable.set()
 * call, or of bundleChanges() call, the queue gets processed in order of _priority.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const PriorityQueue_1 = require("./PriorityQueue");
/**
 * DepItem is an item in a dependency relationship. It may depend on other DepItems. It is used
 * for subscriptions and computed observables.
 */
class DepItem {
    /**
     * Callback should call depItem.useDep(dep) for each DepInput it depends on.
     */
    constructor(callback, optContext) {
        this._priority = 0;
        this._enqueued = false;
        this._callback = callback;
        this._context = optContext;
    }
    static isPrioritySmaller(a, b) {
        return a._priority < b._priority;
    }
    /**
     * Mark depItem as a dependency of this DepItem. The argument may be null to indicate a leaf (an
     * item such as a plain observable, which does not itself depend on anything else).
     */
    useDep(depItem) {
        const p = depItem ? depItem._priority : 0;
        if (p >= this._priority) {
            this._priority = p + 1;
        }
    }
    /**
     * Recompute this DepItem, calling the callback given in the constructor.
     */
    recompute() {
        this._priority = 0;
        this._callback.call(this._context);
    }
    /**
     * Add this DepItem to the queue, to be recomputed when the time is right.
     */
    enqueue() {
        if (!this._enqueued) {
            this._enqueued = true;
            queue.push(this);
        }
    }
}
exports.DepItem = DepItem;
// The main compute queue.
const queue = new PriorityQueue_1.PriorityQueue(DepItem.isPrioritySmaller);
// Array to keep track of items recomputed during this call to compute(). It could be a local
// variable in compute(), but is made global to minimize allocations.
const _seen = [];
// Counter used for bundling multiple calls to compute() into one.
let bundleDepth = 0;
/**
 * Exposed for unittests. Returns the internal priority value of an observable.
 */
function _getPriority(obs) {
    const depItem = obs._getDepItem();
    return depItem ? depItem._priority : 0;
}
exports._getPriority = _getPriority;
/**
 * Update any computed observables that need updating. The update is deferred if we are currently
 * in the middle of a bundle. This is called automatically whenever you set an observable, and
 * there should be no need to ever call this by users of the library.
 */
function compute() {
    if (bundleDepth === 0 && queue.size > 0) {
        // Prevent nested compute() calls, which are unnecessary and can cause deep recursion stack.
        bundleDepth++;
        try {
            // We reuse _seen array to minimize allocations, but always leave it empty.
            do {
                const item = queue.pop();
                _seen.push(item);
                item.recompute();
            } while (queue.size > 0);
        }
        finally {
            // We delay the unsetting of _enqueued flag to here, to protect against infinite loops when
            // a change to a computed causes it to get enqueued again.
            for (const item of _seen) {
                item._enqueued = false;
            }
            _seen.length = 0;
            bundleDepth--;
        }
    }
}
exports.compute = compute;
/**
 * Defer recomputations of all computed observables and subscriptions until func() returns. This
 * is useful to avoid unnecessary recomputation if you are making several changes to observables
 * together. This function is exposed as `observable.bundleChanges()`.
 *
 * Note that this intentionally does not wait for promises to be resolved, since that would block
 * all updates to all computeds while waiting.
 */
function bundleChanges(func) {
    try {
        bundleDepth++;
        return func();
    }
    finally {
        bundleDepth--;
        compute();
    }
}
exports.bundleChanges = bundleChanges;

},{"./PriorityQueue":2}],4:[function(require,module,exports){
"use strict";
/**
 * Implementation of UI components that can be inserted into dom(). See documentation for
 * createElem() and create().
 */
Object.defineProperty(exports, "__esModule", { value: true });
const _domDispose_1 = require("./_domDispose");
const _domImpl_1 = require("./_domImpl");
const _domMethods_1 = require("./_domMethods");
const dispose_1 = require("./dispose");
// Use the browser globals in a way that allows replacing them with mocks in tests.
const browserGlobals_1 = require("./browserGlobals");
/**
 * Helper that takes ownership of a component by mounting it to a parent element.
 */
class DomOwner {
    constructor(_parentElem) {
        this._parentElem = _parentElem;
    }
    autoDispose(comp) { comp.mount(this._parentElem); }
}
/**
 * A UI component should extend this base class and implement a constructor that creates some DOM
 * and calls this.setContent() with it. Compared to a simple function returning DOM (a
 * "functional" component), a "class" component makes it easier to organize code into methods.
 *
 * In addition, a "class" component may be disposed to remove it from the DOM, although this is
 * uncommon since a UI component is normally owned by its containing DOM.
 */
class Component extends dispose_1.Disposable {
    constructor() {
        super();
        this._markerPre = browserGlobals_1.G.document.createComment('A');
        this._markerPost = browserGlobals_1.G.document.createComment('B');
        this._contentToMount = null;
        // If the containing DOM is disposed, it will dispose all of our DOM (included among children
        // of the containing DOM). Let it also dispose this Component when it gets to _markerPost.
        // Since _unmount() is unnecessary here, we skip its work by unseting _markerPre/_markerPost.
        _domDispose_1.onDisposeElem(this._markerPost, () => {
            this._markerPre = this._markerPost = undefined;
            this.dispose();
        });
        // When the component is disposed, unmount the DOM we created (i.e. dispose and remove).
        // Except that we skip this as unnecessary when the disposal is triggered by containing DOM.
        this.onDispose(this._unmount, this);
    }
    /**
     * Create a component using Foo.create(owner, ...args) similarly to creating any other
     * Disposable object. The difference is that `owner` may be a DOM Element, and the content set
     * by the constructor's setContent() call will be appended to and owned by that owner element.
     *
     * If the owner is not an Element, works like a regular Disposable. To add such a component to
     * DOM, use the mount() method.
     */
    // TODO add typescript overloads for strict argument checks.
    static create(owner, ...args) {
        const _owner = owner instanceof browserGlobals_1.G.Element ? new DomOwner(owner) : owner;
        return dispose_1.Disposable.create.call(this, _owner, ...args);
    }
    /**
     * Inserts the content of this component into a parent DOM element.
     */
    mount(elem) {
        // Insert the result of setContent() into the given parent element. Note that mount() must
        // only ever be called once. It is normally called as part of .create().
        if (!this._markerPost) {
            throw new Error('Component mount() called when already disposed');
        }
        if (this._markerPost.parentNode) {
            throw new Error('Component mount() called twice');
        }
        _domImpl_1.update(elem, this._markerPre, this._contentToMount, this._markerPost);
        this._contentToMount = null;
    }
    /**
     * Components should call setContent() with their DOM content, typically in the constructor. If
     * called outside the constructor, setContent() will replace previously set DOM. It accepts any
     * DOM Node; use dom.frag() to insert multiple nodes together.
     */
    setContent(content) {
        if (this._markerPost) {
            if (this._markerPost.parentNode) {
                // Component is already mounted. Replace previous content.
                _domMethods_1.replaceContent(this._markerPre, this._markerPost, content);
            }
            else {
                // Component is created but not yet mounted. Save the content for the mount() call.
                this._contentToMount = content;
            }
        }
    }
    /**
     * Detaches and disposes the DOM created and attached in mount().
     */
    _unmount() {
        // Dispose the owned content, and remove it from the DOM. The conditional skips the work when
        // the unmounting is triggered by the disposal of the containing DOM.
        if (this._markerPost && this._markerPost.parentNode) {
            const elem = this._markerPost.parentNode;
            _domMethods_1.replaceContent(this._markerPre, this._markerPost, null);
            elem.removeChild(this._markerPre);
            elem.removeChild(this._markerPost);
        }
        this._markerPre = this._markerPost = undefined;
    }
}
exports.Component = Component;
/**
 * Construct and insert a UI component into the given DOM element. The component must extend
 * dom.Component, and should build DOM and call setContent(DOM) in the constructor. DOM may be any
 * Node. Use dom.frag() to insert multiple nodes together.
 *
 * Logically, the parent `elem` owns the created component, and the component owns the DOM set by
 * setContent(). If the parent is disposed, so is the component and its DOM. If the component is
 * somehow disposed directly, then its DOM is disposed and removed from `elem`.
 *
 * Note the correct usage:
 *
 *       dom('div', dom.create(Comp1), dom.create(Comp2, ...args))
 *
 * To understand why the syntax is such, consider a potential alterntive such as:
 *
 *       dom('div', _insert_(new Comp1()), _insert_(new Comp2(...args))
 *
 *    In both cases, the constructor for Comp1 runs before the constructor for Comp2. What happens
 *    when Comp2's constructor throws an exception? In the second case, nothing yet owns the
 *    created Comp1 component, and it will never get cleaned up. In the first, correct case,
 *    dom('div') element gets ownership of it early enough and will dispose it.
 *
 * @param {Element} elem: The element to which to append the newly constructed component.
 * @param {Class} ComponentClass: The component class to instantiate. It must extend
 *    dom.Component(...) and implement the render() method.
 * @param {Objects} ...args: Arguments to the Component's constructor.
 */
// TODO add typescript overloads for strict argument checks.
function create(cls, ...args) {
    return (elem) => { cls.create(elem, ...args); };
}
exports.create = create;
/**
 * If you need to initialize a component after creation, you may do it in the middle of a dom()
 * call using createInit(), in which the last of args is initFunc: a function called with the
 * constructed instance of the component:
 *    dom.createInit(MyComponent, ...args, c => {
 *      c.addChild(...);
 *      c.setOption(...);
 *    });
 * The benefit of such inline construction is that the component is owned by the dom element as
 * soon as it's created, so an exception in the init function or later among dom()'s arguments
 * will trigger a cleanup.
 */
function createInit(cls, ...args) {
    return (elem) => {
        const initFunc = args.pop();
        const c = cls.create(elem, ...args);
        initFunc(c);
    };
}
exports.createInit = createInit;

},{"./_domDispose":5,"./_domImpl":7,"./_domMethods":8,"./browserGlobals":10,"./dispose":12}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Private global disposal map. It maintains the association between DOM nodes and cleanup
 * functions added with dom.onDispose(). To support multiple disposers on one element, we use a
 * WeakMap-based linked list:
 *
 *    _disposeMap[elem] = disposer2;
 *    _disposeMap[disposer2] = disposer1;
 *    etc.
 *
 * This avoids allocating arrays or using undeclared properties for a different linked list.
 */
const _disposeMap = new WeakMap();
// Internal helper to walk the DOM tree, calling visitFunc(elem) on all descendants of elem.
// Descendants are processed first.
function _walkDom(elem, visitFunc) {
    let c = elem.firstChild;
    while (c) {
        // Note: this might be better done using an explicit stack, but in practice DOM trees aren't
        // so deep as to cause problems.
        _walkDom(c, visitFunc);
        c = c.nextSibling;
    }
    visitFunc(elem);
}
// Internal helper to run all disposers for a single element.
function _disposeElem(elem) {
    let disposer = _disposeMap.get(elem);
    if (disposer) {
        let key = elem;
        do {
            _disposeMap.delete(key);
            disposer(elem);
            // Find the next disposer; these are chained when there are multiple.
            key = disposer;
            disposer = _disposeMap.get(key);
        } while (disposer);
    }
}
/**
 * Run disposers associated with any descendant of elem or with elem itself. Disposers get
 * associated with elements using dom.onDispose(). Descendants are processed first.
 *
 * It is automatically called if one of the function arguments to dom() throws an exception during
 * element creation. This way any onDispose() handlers set on the unfinished element get called.
 *
 * @param {Element} elem: The element to run disposers on.
 */
function domDispose(elem) {
    _walkDom(elem, _disposeElem);
}
exports.domDispose = domDispose;
/**
 * Associate a disposerFunc with a DOM element. It will be called when the element is disposed
 * using domDispose() on it or any of its parents. If onDispose is called multiple times, all
 * disposerFuncs will be called in reverse order.
 * @param {Element} elem: The element to associate the disposer with.
 * @param {Function} disposerFunc(elem): Will be called when domDispose() is called on the
 *    element or its ancestor.
 * Note that it is not necessary usually to dispose event listeners attached to an element (e.g.
 * with dom.on()) since their lifetime is naturally limited to the lifetime of the element.
 */
function onDisposeElem(elem, disposerFunc) {
    const prevDisposer = _disposeMap.get(elem);
    _disposeMap.set(elem, disposerFunc);
    if (prevDisposer) {
        _disposeMap.set(disposerFunc, prevDisposer);
    }
}
exports.onDisposeElem = onDisposeElem;
function onDispose(disposerFunc) {
    return (elem) => onDisposeElem(elem, disposerFunc);
}
exports.onDispose = onDispose;
/**
 * Make the given element own the disposable, and call its dispose method when domDispose() is
 * called on the element or any of its parents.
 * @param {Element} elem: The element to own the disposable.
 * @param {Disposable} disposable: Anything with a .dispose() method.
 */
function autoDisposeElem(elem, disposable) {
    if (disposable) {
        onDisposeElem(elem, () => disposable.dispose());
    }
}
exports.autoDisposeElem = autoDisposeElem;
function autoDispose(disposable) {
    if (disposable) {
        return (elem) => autoDisposeElem(elem, disposable);
    }
}
exports.autoDispose = autoDispose;

},{}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _domDispose_1 = require("./_domDispose");
const _domImpl_1 = require("./_domImpl");
const _domMethods_1 = require("./_domMethods");
const obsArray_1 = require("./obsArray");
// Use the browser globals in a way that allows replacing them with mocks in tests.
const browserGlobals_1 = require("./browserGlobals");
/**
 * Creates DOM elements for each element of an observable array. As the array is changed, children
 * are added or removed. This works for any array-valued observable, and for obsArray() and
 * computedArray() it works more efficiently for simple changes.
 *
 * The given itemCreateFunc() should return a single DOM node for each item, or null to skip that
 * item. It is called for new items whenever they are spliced in, or the array replaced. The
 * forEach() owns the created nodes, and runs domDispose() on them when they are spliced out.
 *
 * If the created nodes are removed from their parent externally, forEach() will cope with it, but
 * will consider these elements as no longer owned, and will not run domDispose() on them.
 *
 * Note that itemCreateFunc() does not receive an index: an index would only be correct at the
 * time the item is created, and would not reflect further changes to the array.
 *
 * If you'd like to map the DOM node back to its source item, use dom.data() and dom.getData() in
 * itemCreateFunc().
 */
function forEach(obsArray, itemCreateFunc) {
    return (elem) => {
        const markerPre = browserGlobals_1.G.document.createComment('a');
        const markerPost = browserGlobals_1.G.document.createComment('b');
        elem.appendChild(markerPre);
        elem.appendChild(markerPost);
        if (Array.isArray(obsArray)) {
            _domMethods_1.replaceContent(markerPre, markerPost, obsArray.map(itemCreateFunc));
            return;
        }
        const nodes = obsArray_1.computedArray(obsArray, itemCreateFunc);
        nodes.addListener((newArr, oldArr, splice) => {
            if (splice) {
                // Remove the elements that are gone.
                for (const node of splice.deleted) {
                    if (node && node.parentNode === elem) {
                        _domDispose_1.domDispose(node);
                        elem.removeChild(node);
                    }
                }
                if (splice.numAdded > 0) {
                    // Find a valid child immediately following the spliced out portion, for DOM insertion.
                    const endIndex = splice.start + splice.numAdded;
                    let nextElem = markerPost;
                    for (let i = endIndex; i < newArr.length; i++) {
                        const node = newArr[i];
                        if (node && node.parentNode === elem) {
                            nextElem = node;
                            break;
                        }
                    }
                    // Insert the new elements.
                    const content = _domImpl_1.frag(newArr.slice(splice.start, endIndex));
                    elem.insertBefore(content, nextElem);
                }
            }
            else {
                _domMethods_1.replaceContent(markerPre, markerPost, newArr);
            }
        });
        _domMethods_1.replaceContent(markerPre, markerPost, nodes.get());
    };
}
exports.forEach = forEach;

},{"./_domDispose":5,"./_domImpl":7,"./_domMethods":8,"./browserGlobals":10,"./obsArray":17}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _domDispose_1 = require("./_domDispose");
const _domMethods_1 = require("./_domMethods");
// Use the browser globals in a way that allows replacing them with mocks in tests.
const browserGlobals_1 = require("./browserGlobals");
// The goal of the above declarations is to get help from TypeScript in detecting incorrect usage:
//  import {text, hide} from './_domMethods';
//  dom('div', text('hello'));        // OK
//  dom('div', hide(true));           // OK
//  dom('div', {title: 'hello'});     // OK
//  frag(text('hello'));              // OK
//  frag(hide(true));                 // Bad: DocumentFragment is not an Element
//  frag({title: 'hello'});           // Bad: DocumentFragment is not an Element
/**
 * dom('tag#id.class1.class2', ...args)
 *   The first argument is a string consisting of a tag name, with optional #foo suffix
 *   to add the ID 'foo', and zero or more .bar suffixes to add a CSS class 'bar'.
 *
 * The rest of the arguments are optional and may be:
 *
 *   Nodes - which become children of the created element;
 *   strings - which become text node children;
 *   objects - of the form {attr: val} to set additional attributes on the element;
 *   Arrays - which are flattened with each item processed recursively;
 *   functions - which are called with elem as the argument, for a chance to modify the
 *       element as it's being created. Return values are processed recursively.
 *   "dom methods" - expressions such as `dom.attr('href', url)` or `dom.hide(obs)`, which
 *       are actually special cases of the "functions" category.
 */
function dom(tagString, ...args) {
    return _updateWithArgsOrDispose(_createFromTagString(_createElementHtml, tagString), args);
}
exports.dom = dom;
/**
 * svg('tag#id.class1.class2', ...args)
 *  Same as dom(...), but creates an SVG element.
 */
function svg(tagString, ...args) {
    return _updateWithArgsOrDispose(_createFromTagString(_createElementSvg, tagString), args);
}
exports.svg = svg;
// Internal helper used to create HTML elements.
function _createElementHtml(tag) {
    return browserGlobals_1.G.document.createElement(tag);
}
// Internal helper used to create SVG elements.
function _createElementSvg(tag) {
    return browserGlobals_1.G.document.createElementNS("http://www.w3.org/2000/svg", tag);
}
/**
 * Internal helper to parse tagString, create an element using createFunc with the given tag, and
 * set its id and classes from the tagString.
 * @param {Funtion} createFunc(tag): Function that should create an element given a tag name.
 *    It is passed in to allow creating elements in different namespaces (e.g. plain HTML vs SVG).
 * @param {String} tagString: String of the form "tag#id.class1.class2" where id and classes are
 *    optional.
 * @return {Element} The result of createFunc(), possibly with id and class attributes also set.
 */
function _createFromTagString(createFunc, tagString) {
    // We do careful hand-written parsing rather than use a regexp for speed. Using a regexp is
    // significantly more expensive.
    let tag;
    let id;
    let classes;
    let dotPos = tagString.indexOf(".");
    const hashPos = tagString.indexOf('#');
    if (dotPos === -1) {
        dotPos = tagString.length;
    }
    else {
        classes = tagString.substring(dotPos + 1).replace(/\./g, ' ');
    }
    if (hashPos === -1) {
        tag = tagString.substring(0, dotPos);
    }
    else if (hashPos > dotPos) {
        throw new Error(`ID must come before classes in dom("${tagString}")`);
    }
    else {
        tag = tagString.substring(0, hashPos);
        id = tagString.substring(hashPos + 1, dotPos);
    }
    const elem = createFunc(tag);
    if (id) {
        elem.setAttribute('id', id);
    }
    if (classes) {
        elem.setAttribute('class', classes);
    }
    return elem;
}
function update(elem, ...args) {
    return _updateWithArgs(elem, args);
}
exports.update = update;
function _updateWithArgs(elem, args) {
    for (const arg of args) {
        _updateWithArg(elem, arg);
    }
    return elem;
}
function _updateWithArgsOrDispose(elem, args) {
    try {
        return _updateWithArgs(elem, args);
    }
    catch (e) {
        _domDispose_1.domDispose(elem);
        throw e;
    }
}
function _updateWithArg(elem, arg) {
    if (typeof arg === 'function') {
        const value = arg(elem);
        // Skip the recursive call in the common case when the function returns nothing.
        if (value !== undefined && value !== null) {
            _updateWithArg(elem, value);
        }
    }
    else if (Array.isArray(arg)) {
        _updateWithArgs(elem, arg);
    }
    else if (arg === undefined || arg === null) {
        // Nothing to do.
    }
    else if (arg instanceof browserGlobals_1.G.Node) {
        elem.appendChild(arg);
    }
    else if (typeof arg === 'object') {
        _domMethods_1.attrsElem(elem, arg);
    }
    else {
        elem.appendChild(browserGlobals_1.G.document.createTextNode(arg));
    }
}
/**
 * Creates a DocumentFragment processing arguments the same way as the dom() function.
 */
function frag(...args) {
    const elem = browserGlobals_1.G.document.createDocumentFragment();
    return _updateWithArgsOrDispose(elem, args);
}
exports.frag = frag;
/**
 * Find the first element matching a selector; just an abbreviation for document.querySelector().
 */
function find(selector) { return browserGlobals_1.G.document.querySelector(selector); }
exports.find = find;
/**
 * Find all elements matching a selector; just an abbreviation for document.querySelectorAll().
 */
function findAll(selector) { return browserGlobals_1.G.document.querySelectorAll(selector); }
exports.findAll = findAll;

},{"./_domDispose":5,"./_domMethods":8,"./browserGlobals":10}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _domDispose_1 = require("./_domDispose");
const _domImpl_1 = require("./_domImpl");
const binding_1 = require("./binding");
// Use the browser globals in a way that allows replacing them with mocks in tests.
const browserGlobals_1 = require("./browserGlobals");
/**
 * Private global map for associating arbitrary data with DOM. It's a WeakMap, so does not prevent
 * values from being garbage collected when the owning DOM elements are no longer used.
 */
const _dataMap = new WeakMap();
/**
 * Internal helper that binds the callback to valueObs, which may be a value, observble, or
 * function, and attaches a disposal callback to the passed-in element.
 */
function _subscribe(elem, valueObs, callback) {
    _domDispose_1.autoDisposeElem(elem, binding_1.subscribe(valueObs, callback));
}
/**
 * Sets multiple attributes of a DOM element. The `attrs()` variant takes no `elem` argument.
 * Null and undefined values are omitted, and booleans are either omitted or set to empty string.
 * @param {Object} attrsObj: Object mapping attribute names to attribute values.
 */
function attrsElem(elem, attrsObj) {
    for (const key of Object.keys(attrsObj)) {
        const val = attrsObj[key];
        if (val != null && val !== false) {
            elem.setAttribute(key, val === true ? '' : val);
        }
    }
}
exports.attrsElem = attrsElem;
function attrs(attrsObj) {
    return (elem) => attrsElem(elem, attrsObj);
}
exports.attrs = attrs;
/**
 * Sets an attribute of a DOM element to the given value. Removes the attribute when the value is
 * null or undefined. The `attr()` variant takes no `elem` argument, and `attrValue` may be an
 * observable or function.
 * @param {Element} elem: The element to update.
 * @param {String} attrName: The name of the attribute to bind, e.g. 'href'.
 * @param {String|null} attrValue: The string value or null to remove the attribute.
 */
function attrElem(elem, attrName, attrValue) {
    if (attrValue === null || attrValue === undefined) {
        elem.removeAttribute(attrName);
    }
    else {
        elem.setAttribute(attrName, attrValue);
    }
}
exports.attrElem = attrElem;
function attr(attrName, attrValueObs) {
    return (elem) => _subscribe(elem, attrValueObs, (val) => attrElem(elem, attrName, val));
}
exports.attr = attr;
/**
 * Sets or removes a boolean attribute of a DOM element. According to the spec, empty string is a
 * valid true value for the attribute, and the false value is indicated by the attribute's absence.
 * The `boolAttr()` variant takes no `elem`, and `boolValue` may be an observable or function.
 * @param {Element} elem: The element to update.
 * @param {String} attrName: The name of the attribute to bind, e.g. 'checked'.
 * @param {Boolean} boolValue: Boolean value whether to set or unset the attribute.
 */
function boolAttrElem(elem, attrName, boolValue) {
    attrElem(elem, attrName, boolValue ? '' : null);
}
exports.boolAttrElem = boolAttrElem;
function boolAttr(attrName, boolValueObs) {
    return (elem) => _subscribe(elem, boolValueObs, (val) => boolAttrElem(elem, attrName, val));
}
exports.boolAttr = boolAttr;
/**
 * Adds a text node to the element. The `text()` variant takes no `elem`, and `value` may be an
 * observable or function.
 * @param {Element} elem: The element to update.
 * @param {String} value: The text value to add.
 */
function textElem(elem, value) {
    elem.appendChild(browserGlobals_1.G.document.createTextNode(value));
}
exports.textElem = textElem;
function text(valueObs) {
    return (elem) => {
        const textNode = browserGlobals_1.G.document.createTextNode('');
        _subscribe(elem, valueObs, (val) => { textNode.nodeValue = val; });
        elem.appendChild(textNode);
    };
}
exports.text = text;
/**
 * Sets a style property of a DOM element to the given value. The `style()` variant takes no
 * `elem`, and `value` may be an observable or function.
 * @param {Element} elem: The element to update.
 * @param {String} property: The name of the style property to update, e.g. 'fontWeight'.
 * @param {String} value: The value for the property.
 */
function styleElem(elem, property, value) {
    elem.style[property] = value;
}
exports.styleElem = styleElem;
function style(property, valueObs) {
    return (elem) => _subscribe(elem, valueObs, (val) => styleElem(elem, property, val));
}
exports.style = style;
/**
 * Sets the property of a DOM element to the given value.
 * The `prop()` variant takes no `elem`, and `value` may be an observable or function.
 * @param {Element} elem: The element to update.
 * @param {String} property: The name of the property to update, e.g. 'disabled'.
 * @param {Object} value: The value for the property.
 */
function propElem(elem, property, value) {
    elem[property] = value;
}
exports.propElem = propElem;
function prop(property, valueObs) {
    return (elem) => _subscribe(elem, valueObs, (val) => propElem(elem, property, val));
}
exports.prop = prop;
/**
 * Shows or hides the element depending on a boolean value. Note that the element must be visible
 * initially (i.e. unsetting style.display should show it).
 * The `show()` variant takes no `elem`, and `boolValue` may be an observable or function.
 * @param {Element} elem: The element to update.
 * @param {Boolean} boolValue: True to show the element, false to hide it.
 */
function showElem(elem, boolValue) {
    elem.style.display = boolValue ? '' : 'none';
}
exports.showElem = showElem;
function show(boolValueObs) {
    return (elem) => _subscribe(elem, boolValueObs, (val) => showElem(elem, val));
}
exports.show = show;
/**
 * The opposite of show, hiding the element when boolValue is true.
 * The `hide()` variant takes no `elem`, and `boolValue` may be an observable or function.
 * @param {Element} elem: The element to update.
 * @param {Boolean} boolValue: True to hide the element, false to show it.
 */
function hideElem(elem, boolValue) {
    elem.style.display = boolValue ? 'none' : '';
}
exports.hideElem = hideElem;
function hide(boolValueObs) {
    return (elem) => _subscribe(elem, boolValueObs, (val) => hideElem(elem, val));
}
exports.hide = hide;
/**
 * Sets or toggles the given css class className.
 */
function clsElem(elem, className, boolValue = true) {
    elem.classList.toggle(className, Boolean(boolValue));
}
exports.clsElem = clsElem;
function cls(className, boolValue) {
    if (typeof className !== 'string') {
        return _clsDynamicPrefix('', className);
    }
    else if (!boolValue || typeof boolValue === 'boolean') {
        return (elem) => clsElem(elem, className, boolValue);
    }
    else {
        return (elem) => _subscribe(elem, boolValue, (val) => clsElem(elem, className, val));
    }
}
exports.cls = cls;
function clsPrefix(prefix, className, boolValue) {
    if (typeof className !== 'string') {
        return _clsDynamicPrefix(prefix, className);
    }
    else {
        return cls(prefix + className, boolValue);
    }
}
exports.clsPrefix = clsPrefix;
function _clsDynamicPrefix(prefix, className) {
    return (elem) => {
        let prevClass = null;
        _subscribe(elem, className, (name) => {
            if (prevClass) {
                elem.classList.remove(prevClass);
            }
            prevClass = name ? prefix + name : null;
            if (prevClass) {
                elem.classList.add(prevClass);
            }
        });
    };
}
/**
 * Associate arbitrary data with a DOM element. The `data()` variant takes no `elem`, and `value`
 * may be an observable or function.
 * @param {Element} elem: The element with which to associate data.
 * @param {String} key: Key to identify this piece of data among others attached to elem.
 * @param {Object} value: Arbitrary value to associate with elem.
 */
function dataElem(elem, key, value) {
    const obj = _dataMap.get(elem);
    if (obj) {
        obj[key] = value;
    }
    else {
        _domDispose_1.onDisposeElem(elem, () => _dataMap.delete(elem));
        _dataMap.set(elem, { [key]: value });
    }
}
exports.dataElem = dataElem;
function data(key, valueObs) {
    return (elem) => _subscribe(elem, valueObs, (val) => dataElem(elem, key, val));
}
exports.data = data;
function getData(elem, key) {
    const obj = _dataMap.get(elem);
    return obj && obj[key];
}
exports.getData = getData;
/**
 * Replaces the content between nodeBefore and nodeAfter, which should be two siblings within the
 * same parent node. New content may be anything allowed as an argument to dom(), including null
 * to insert nothing. Runs disposers, if any, on all removed content.
 */
function replaceContent(nodeBefore, nodeAfter, content) {
    const elem = nodeBefore.parentNode;
    if (elem) {
        let next;
        for (let n = nodeBefore.nextSibling; n && n !== nodeAfter; n = next) {
            next = n.nextSibling;
            _domDispose_1.domDispose(n);
            elem.removeChild(n);
        }
        if (content) {
            elem.insertBefore(content instanceof browserGlobals_1.G.Node ? content : _domImpl_1.frag(content), nodeAfter);
        }
    }
}
exports.replaceContent = replaceContent;
function domComputed(valueObs, contentFunc) {
    const _contentFunc = contentFunc || identity;
    return (elem) => {
        const markerPre = browserGlobals_1.G.document.createComment('a');
        const markerPost = browserGlobals_1.G.document.createComment('b');
        elem.appendChild(markerPre);
        elem.appendChild(markerPost);
        _subscribe(elem, valueObs, (value) => replaceContent(markerPre, markerPost, _contentFunc(value)));
    };
}
exports.domComputed = domComputed;
function identity(arg) { return arg; }
/**
 * Conditionally appends DOM to an element. The value may be an observable or function (from which
 * a computed is created), whose value -- if truthy -- will be passed to `contentFunc` which
 * should return DOM content. If the value is falsy, DOM content is removed.
 *
 * Note that if the observable changes between different truthy values, contentFunc gets called
 * for each value, and previous content gets destroyed. To consider all truthy values the same,
 * use an observable that returns a proper boolean, e.g.
 *
 *    dom.maybe(use => Boolean(use(fooObs)), () => dom(...));
 *
 * As with domComputed(), dom.maybe() may but should not be used when the argument is not an
 * observable or function. The following are equivalent:
 *
 *    dom(..., dom.maybe(myValue, () => dom(...)));
 *    dom(..., myValue ? dom(...) : null);
 *
 * The latter is preferred for being simpler.
 *
 * @param {Element} elem: The element to which to append the DOM content.
 * @param {Object} boolValueObs: Observable or function for a computed.
 * @param [Function] contentFunc: Function called with the result of boolValueObs when it is
 *    truthy. Should returning DOM as output.
 */
function maybe(boolValueObs, contentFunc) {
    return domComputed(boolValueObs, (value) => value ? contentFunc(value) : null);
}
exports.maybe = maybe;
/**
 * See documentation for TestId above.
 */
function makeTestId(prefix) {
    return clsPrefix.bind(null, prefix);
}
exports.makeTestId = makeTestId;
/**
 * See documentation for TestId above.
 */
exports.noTestId = (name) => null;

},{"./_domDispose":5,"./_domImpl":7,"./binding":9,"./browserGlobals":10}],9:[function(require,module,exports){
"use strict";
/**
 * binding.ts offers a convenient subscribe() function that creates a binding to an observable, a
 * a plain value, or a function from which it builds a computed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const computed_1 = require("./computed");
const observable_1 = require("./observable");
/**
 * Subscribes a callback to valueObs, which may be one a plain value, an observable, a knockout
 * observable, or a function. If a function, it's used to create a computed() and will be called
 * with a context function `use`, allowing it to depend on other observable values (see
 * documentation for `computed`).
 *
 * In all cases, `callback(newValue, oldValue)` is called immediately and whenever the value
 * changes. On the initial call, oldValue is undefined.
 *
 * Returns an object which should be disposed to remove the created subscriptions, or null.
 */
function subscribe(valueObs, callback) {
    // A plain function (to make a computed from), or a knockout observable.
    if (typeof valueObs === 'function') {
        // Knockout observable.
        const koValue = valueObs;
        if (typeof koValue.peek === 'function') {
            let savedValue = koValue.peek();
            const sub = koValue.subscribe((val) => {
                const old = savedValue;
                savedValue = val;
                callback(val, old);
            });
            callback(savedValue, undefined);
            return sub;
        }
        // Function from which to make a computed. Note that this is also reasonable:
        //    let sub = subscribe(use => callback(valueObs(use)));
        // The difference is that when valueObs() evaluates to unchanged value, callback would be
        // called in the version above, but not in the version below.
        const comp = computed_1.computed(valueObs);
        comp.addListener(callback);
        callback(comp.get(), undefined);
        return comp; // Disposing this will dispose its one listener.
    }
    // An observable.
    if (valueObs instanceof observable_1.Observable) {
        const sub = valueObs.addListener(callback);
        callback(valueObs.get(), undefined);
        return sub;
    }
    callback(valueObs, undefined);
    return null;
}
exports.subscribe = subscribe;

},{"./computed":11,"./observable":18}],10:[function(require,module,exports){
"use strict";
/**
 * Module that allows client-side code to use browser globals (such as `document` or `Node`) in a
 * way that allows those globals to be replaced by mocks in browser-less tests.
 *
 *    import {G} from 'browserGlobals';
 *    ... use G.document
 *    ... use G.Node
 *
 * Initially, the global `window` object, is the source of the global values.
 *
 * To use a mock of globals in a test, use:
 *
 *    import {pushGlobals, popGlobals} as G from 'browserGlobals';
 *    before(function() {
 *      pushGlobals(mockWindow);    // e.g. jsdom.jsdom(...).defaultView
 *    });
 *    after(function() {
 *      popGlobals();
 *    });
 */
Object.defineProperty(exports, "__esModule", { value: true });
function _updateGlobals(dest, source) {
    dest.DocumentFragment = source.DocumentFragment;
    dest.Element = source.Element;
    dest.Node = source.Node;
    dest.document = source.document;
    dest.window = source.window;
}
// The initial IBrowserGlobals object.
const initial = {};
_updateGlobals(initial, (typeof window !== 'undefined' ? window : {}));
// The globals G object strats out with a copy of `initial`.
exports.G = Object.assign({}, initial);
// The stack of globals that always has the intial object, but which may be overridden.
const _globalsStack = [initial];
/**
 * Replace globals with those from the given object. Use popGlobals() to restore previous values.
 */
function pushGlobals(globals) {
    _globalsStack.push(globals);
    _updateGlobals(exports.G, globals);
}
exports.pushGlobals = pushGlobals;
/**
 * Restore the values of globals to undo the preceding pushGlobals() call.
 */
function popGlobals() {
    if (_globalsStack.length > 1) {
        _globalsStack.pop();
    }
    _updateGlobals(exports.G, _globalsStack[_globalsStack.length - 1]);
}
exports.popGlobals = popGlobals;

},{}],11:[function(require,module,exports){
"use strict";
/**
 * computed.js implements a computed observable, whose value depends on other observables and gets
 * recalculated automatically when they change.
 *
 * E.g. if we have some existing observables (which may themselves be instances of `computed`),
 * we can create a computed that subscribes to them explicitly:
 *  let obs1 = observable(5), obs2 = observable(12);
 *  let computed1 = computed(obs1, obs2, (use, v1, v2) => v1 + v2);
 *
 * or implicitly by using `use(obs)` function:
 *  let computed2 = computed(use => use(obs1) + use(obs2));
 *
 * In either case, computed1.get() and computed2.get() will have the value 17. If obs1 or obs2 is
 * changed, computed1 and computed2 will get recomputed automatically.
 *
 * Creating a computed allows any number of dependencies to be specified explicitly, and their
 * values will be passed to the read() callback. These may be combined with automatic dependencies
 * detected using use(). Note that constructor dependencies have less overhead.
 *
 *  let val = computed(...deps, ((use, ...depValues) => READ_CALLBACK));
 *
 * You may specify a `write` callback by calling `onWrite(WRITE_CALLBACK)`, which will be called
 * whenever set() is called on the computed by its user. If a `write` bacllback is not specified,
 * calling `set` on a computed observable will throw an exception.
 *
 * Note that pureComputed.js offers a variation of computed() with the same interface, but which
 * stays unsubscribed from dependencies while it itself has no subscribers.
 *
 * A computed may be used with a disposable value using `use.owner` as the value's owner. E.g.
 *    let val = computed((use) => Foo.create(use.owner, use(a), use(b)));
 *
 * When the computed() is re-evaluated, and when it itself is disposed, it disposes the previously
 * owned value. Note that only the pattern above works, i.e. use.owner may only be used to take
 * ownership of the same disposable that the callback returns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const observable_1 = require("./observable");
const subscribe_1 = require("./subscribe");
function _noWrite() {
    throw new Error("Can't write to non-writable computed");
}
class Computed extends observable_1.Observable {
    /**
     * Internal constructor for a Computed observable. You should use computed() function instead.
     */
    constructor(callback, dependencies) {
        // At initialization we force an undefined value even though it's not of type T: it gets set
        // to a proper value during the creation of new Subscription, which calls this._read.
        super(undefined);
        this._callback = callback;
        this._write = _noWrite;
        this._sub = new subscribe_1.Subscription(this._read.bind(this), dependencies, this);
    }
    /**
     * Used by subscriptions to keep track of dependencies.
     */
    _getDepItem() {
        return this._sub._getDepItem();
    }
    /**
     * "Sets" the value of the computed by calling the write() callback if one was provided in the
     * constructor. Throws an error if there was no such callback (not a "writable" computed).
     * @param {Object} value: The value to pass to the write() callback.
     */
    set(value) { this._write(value); }
    /**
     * Set callback to call when this.set(value) is called, to make it a writable computed. If not
     * set, attempting to write to this computed will throw an exception.
     */
    onWrite(writeFunc) {
        this._write = writeFunc;
        return this;
    }
    /**
     * Disposes the computed, unsubscribing it from all observables it depends on.
     */
    dispose() {
        this._sub.dispose();
        super.dispose();
    }
    _read(use, ...args) {
        super.set(this._callback(use, ...args));
    }
}
exports.Computed = Computed;
/**
 * Creates a new Computed.
 * @param {Observable} ...observables: The initial params, of which there may be zero or more, are
 *    observables on which this computed depends. When any of them change, the read() callback
 *    will be called with the values of these observables as arguments.
 * @param {Function} readCallback: Read callback that will be called with (use, ...values),
 *    i.e. the `use` function and values for all of the ...observables. The callback is called
 *    immediately and whenever any dependency changes.
 * @returns {Computed} The newly created computed observable.
 */
function computed(...args) {
    const readCb = args.pop();
    return new Computed(readCb, args);
}
exports.computed = computed;
// TODO Consider implementing .singleUse() method.
// An open question is in how to pass e.g. kd.hide(computed(x, x => !x)) in such a way that
// the temporary computed can be disposed when temporary, but not otherwise. A function-only
// syntax is kd.hide(use => !use(x)), but prevents use of static subscriptions.
//
// (a) function-only use of computeds is fine and useful.
// (b) pureComputed is another option, and doesn't technically require getting disposed.
// (c) kd.hide(compObs), kd.autoDispose(compObs) is more general and
//     can be replaced more concisely by kd.hide(compObs.singleUse())
// .singleUse() automatically disposes a computed (or an observable?) once there are no
// subscriptions to it. If there are no subscriptions at the time of this call, waits for the next
// tick, and possibly disposes then.

},{"./observable":18,"./subscribe":20}],12:[function(require,module,exports){
"use strict";
/**
 * dispose.js provides tools to objects that needs to dispose resources, such as destroy DOM, and
 * unsubscribe from events. The motivation with examples is presented here:
 *
 *    https://phab.getgrist.com/w/disposal/
 *
 * Disposable is a class for components that need cleanup (e.g. maintain DOM, listen to events,
 * subscribe to anything). It provides a .dispose() method that should be called to destroy the
 * component, and .onDispose()/.autoDispose() methods that the component should use to take
 * responsibility for other pieces that require cleanup.
 *
 * To define a disposable class:
 *    class Foo extends Disposable { ... }
 *
 * To create Foo:
 *    const foo = Foo.create(owner, ...args);
 * This is better than `new Foo` for two reasons:
 *    1. If Foo's constructor throws an exception, any disposals registered in that constructor
 *       before the exception are honored.
 *    2. It ensures you specify the owner of the new instance (but you can use null to skip it).
 *
 * In Foo's constructor (or rarely methods), take ownership of other Disposable objects:
 *    this.bar = Bar.create(this, ...);
 *
 * For objects that are not instances of Disposable but have a .dispose() methods, use:
 *    this.bar = this.autoDispose(createSomethingDisposable());
 *
 * To call a function on disposal (e.g. to add custom disposal logic):
 *    this.onDispose(() => this.myUnsubscribeAllMethod());
 *    this.onDispose(this.myUnsubscribeAllMethod, this);    // slightly more efficient
 *
 * To mark this object to be wiped out on disposal (i.e. set all properties to null):
 *    this.wipeOnDispose();
 * See the documentation of that method for more info.
 *
 * To dispose Foo directly:
 *    foo.dispose();
 * To determine if an object has already been disposed:
 *    foo.isDisposed()
 *
 * If you need to replace an owned object, or release, or dispose it early, use a Holder:
 *    this._holder = Holder.create(this);
 *    Bar.create(this._holder, 1);      // creates new Bar(1)
 *    Bar.create(this._holder, 2);      // creates new Bar(2) and disposes previous object
 *    this._holder.clear();             // disposes contained object
 *    this._holder.release();           // releases contained object
 *
 * If creating your own class with a dispose() method, do NOT throw exceptions from dispose().
 * These cannot be handled properly in all cases. Read here about the same issue in C++:
 *    http://bin-login.name/ftp/pub/docs/programming_languages/cpp/cffective_cpp/MAGAZINE/SU_FRAME.HTM#destruct
 */
Object.defineProperty(exports, "__esModule", { value: true });
const emit_1 = require("./emit");
// Internal "owner" of disposable objects which doesn't actually dispose or keep track of them. It
// is the effective owner when creating a Disposable with `new Foo()` rather than `Foo.create()`.
const _noopOwner = {
    autoDispose(obj) { },
};
// Newly-created Disposable instances will have this as their owner. This is not a constant, it
// is used by create() for the safe creation of Disposables.
let _defaultDisposableOwner = _noopOwner;
/**
 * Base class for disposable objects that can own other objects. See the module documentation.
 */
class Disposable {
    constructor() {
        this._disposalList = new DisposalList();
        // This registers with a temp Holder when using create(), and is a no-op when using `new Foo`.
        _defaultDisposableOwner.autoDispose(this);
    }
    static create(owner, ...args) {
        const origDefaultOwner = _defaultDisposableOwner;
        const holder = new Holder();
        try {
            // The newly-created object will have holder as its owner.
            _defaultDisposableOwner = holder;
            return setDisposeOwner(owner, new this(...args));
        }
        catch (e) {
            try {
                // This calls dispose on the partially-constructed object
                holder.clear();
            }
            catch (e2) {
                // tslint:disable-next-line:no-console
                console.error("Error disposing partially constructed %s:", this.name, e2);
            }
            throw e;
        }
        finally {
            // On success, the new object has a new owner, and we release it from holder.
            // On error, the holder has been cleared, and the release() is a no-op.
            holder.release();
            _defaultDisposableOwner = origDefaultOwner;
        }
    }
    /** Take ownership of obj, and dispose it when this.dispose() is called. */
    autoDispose(obj) {
        this.onDispose(obj.dispose, obj);
        return obj;
    }
    /** Call the given callback when this.dispose() is called. */
    onDispose(callback, context) {
        this._disposalList.addListener(callback, context);
    }
    /**
     * Wipe out this object when it is disposed, i.e. set all its properties to null. It is
     * recommended to call this early in the constructor.
     *
     * This makes disposal more costly, but has certain benefits:
     * - If anything still refers to the object and uses it, we'll get an early error, rather than
     *   silently keep going, potentially doing useless work (or worse) and wasting resources.
     * - If anything still refers to the object (even without using it), the fields of the object
     *   can still be garbage-collected.
     * - If there are circular references involving this object, they get broken, making the job
     *   easier for the garbage collector.
     *
     * The recommendation is to use it for complex, longer-lived objects, but to skip for objects
     * which are numerous and short-lived (and less likely to be referenced from unexpected places).
     */
    wipeOnDispose() {
        this.onDispose(this._wipeOutObject, this);
    }
    /**
     * Returns whether this object has already been disposed.
     */
    isDisposed() {
        return this._disposalList === null;
    }
    /**
     * Clean up `this` by disposing all owned objects, and calling onDispose() callbacks, in reverse
     * order to that in which they were added.
     */
    dispose() {
        const disposalList = this._disposalList;
        this._disposalList = null;
        disposalList.callAndDispose(this);
    }
    /**
     * Wipe out this object by setting each property to null. This is helpful for objects that are
     * disposed and should be ready to be garbage-collected.
     */
    _wipeOutObject() {
        // The sentinel value doesn't have to be null, but some values cause more helpful errors than
        // others. E.g. if a.x = "disposed", then a.x.foo() throws "undefined is not a function", but
        // when a.x = null, a.x.foo() throws a more helpful "Cannot read property 'foo' of null".
        for (const k of Object.keys(this)) {
            this[k] = null;
        }
    }
}
exports.Disposable = Disposable;
/**
 * Holder keeps a single disposable object. If given responsibility for another object using
 * holder.autoDispose() or Foo.create(holder, ...), it automatically disposes the currently held
 * object. It also disposes it when the holder itself is disposed.
 *
 * If the object is an instance of Disposable, the holder will also notice when the object gets
 * disposed from outside of it, in which case the holder will become empty again.
 *
 * TODO Holder needs unittests.
 */
class Holder {
    constructor() {
        this._owned = null;
    }
    static create(owner) {
        return setDisposeOwner(owner, new Holder());
    }
    /** Take ownership of a new object, disposing the previously held one. */
    autoDispose(obj) {
        if (this._owned) {
            this._owned.dispose();
        }
        this._owned = obj;
        if (obj instanceof Disposable) {
            obj.onDispose(this.release, this);
        }
        return obj;
    }
    /** Releases the held object without disposing it, emptying the holder. */
    release() {
        const ret = this._owned;
        this._owned = null;
        return ret;
    }
    /** Disposes the held object and empties the holder. */
    clear() {
        if (this._owned) {
            this._owned.dispose();
            this._owned = null;
        }
    }
    /** Returns the held object, or null if the Holder is empty. */
    get() { return this._owned; }
    /** Returns whether the Holder is empty. */
    isEmpty() { return !this._owned; }
    /** When the holder is disposed, it disposes the held object if any. */
    dispose() { this.clear(); }
}
exports.Holder = Holder;
/**
 * Sets owner of obj (i.e. calls owner.autoDispose(obj)) unless owner is null. Returns obj.
 */
function setDisposeOwner(owner, obj) {
    if (owner) {
        owner.autoDispose(obj);
    }
    return obj;
}
exports.setDisposeOwner = setDisposeOwner;
/**
 * Helper for reporting errors during disposal. Try to report the type of the object.
 */
function _describe(obj) {
    return (obj && obj.constructor && obj.constructor.name ? obj.constructor.name : '' + obj);
}
/**
 * DisposalList is an internal class mimicking emit.Emitter. The difference is that callbacks are
 * called in reverse order, and exceptions in callbacks are reported and swallowed.
 */
class DisposalList extends emit_1.LLink {
    constructor() { super(); }
    addListener(callback, optContext) {
        const lis = new DisposeListener(callback, optContext);
        this._insertBefore(this._next, lis);
    }
    /**
     * Call all callbacks and dispose this object. The owner is required for better reporting of
     * errors if any callback throws.
     */
    callAndDispose(owner) {
        try {
            DisposeListener.callAll(this._next, this, owner);
        }
        finally {
            this._disposeList();
        }
    }
}
/**
 * Internal class that keeps track of one item of the DisposalList. It mimicks emit.Listener, but
 * reports and swallows erros when it calls the callbacks in the list.
 */
class DisposeListener extends emit_1.LLink {
    constructor(callback, context) {
        super();
        this.callback = callback;
        this.context = context;
    }
    static callAll(begin, end, owner) {
        while (begin !== end) {
            const lis = begin;
            try {
                lis.callback.call(lis.context);
            }
            catch (e) {
                // tslint:disable-next-line:no-console
                console.error("While disposing %s, error disposing %s: %s", _describe(owner), _describe(this), e);
            }
            begin = lis._next;
        }
    }
}

},{"./emit":15}],13:[function(require,module,exports){
"use strict";
/**
 * dom.js provides a way to build a DOM tree easily.
 *
 * E.g.
 *  import {dom} from 'grainjs';
 *  dom('a#link.c1.c2', {'href': url}, 'Hello ', dom('span', 'world'));
 *    creates Node <a id="link" class="c1 c2" href={{url}}Hello <span>world</span></a>.
 *
 *  dom.frag(dom('span', 'Hello'), ['blah', dom('div', 'world')])
 *    creates document fragment with <span>Hello</span>blah<div>world</div>.
 *
 * DOM can also be created and modified inline during creation:
 *  dom('a#id.c1',
 *      dom.cls('c2'), dom.attr('href', url),
 *      dom.text('Hello '), dom('span', dom.text('world')))
 *    creates Node <a id="link" class="c1 c2" href={{url}}Hello <span>world</span></a>,
 *    identical to the first example above.
 */
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
// We keep various dom-related functions organized in private modules, but they are exposed here.
var _domImpl_1 = require("./_domImpl");
exports.svg = _domImpl_1.svg;
exports.update = _domImpl_1.update;
exports.frag = _domImpl_1.frag;
exports.find = _domImpl_1.find;
exports.findAll = _domImpl_1.findAll;
__export(require("./_domComponent"));
__export(require("./_domDispose"));
__export(require("./_domForEach"));
__export(require("./_domMethods"));
__export(require("./domevent"));
const _domComponent = require("./_domComponent");
const _domDispose = require("./_domDispose");
const _domForEach = require("./_domForEach");
const _domImpl = require("./_domImpl");
const _domMethods = require("./_domMethods");
const domevent = require("./domevent");
// We just want to re-export _domImpl.dom, but to allow adding methods to it in a typesafe way,
// TypeScript wants us to declare a real function in the same file.
function dom(tagString, ...args) {
    return _domImpl.dom(tagString, ...args);
}
exports.dom = dom;
// Additionally export all methods as properties of dom() function.
(function (dom) {
    dom.svg = _domImpl.svg;
    dom.frag = _domImpl.frag;
    dom.update = _domImpl.update;
    dom.find = _domImpl.find;
    dom.findAll = _domImpl.findAll;
    dom.domDispose = _domDispose.domDispose;
    dom.onDisposeElem = _domDispose.onDisposeElem;
    dom.onDispose = _domDispose.onDispose;
    dom.autoDisposeElem = _domDispose.autoDisposeElem;
    dom.autoDispose = _domDispose.autoDispose;
    dom.attrsElem = _domMethods.attrsElem;
    dom.attrs = _domMethods.attrs;
    dom.attrElem = _domMethods.attrElem;
    dom.attr = _domMethods.attr;
    dom.boolAttrElem = _domMethods.boolAttrElem;
    dom.boolAttr = _domMethods.boolAttr;
    dom.textElem = _domMethods.textElem;
    dom.text = _domMethods.text;
    dom.styleElem = _domMethods.styleElem;
    dom.style = _domMethods.style;
    dom.propElem = _domMethods.propElem;
    dom.prop = _domMethods.prop;
    dom.showElem = _domMethods.showElem;
    dom.show = _domMethods.show;
    dom.hideElem = _domMethods.hideElem;
    dom.hide = _domMethods.hide;
    dom.clsElem = _domMethods.clsElem;
    dom.cls = _domMethods.cls;
    dom.clsPrefix = _domMethods.clsPrefix;
    dom.dataElem = _domMethods.dataElem;
    dom.data = _domMethods.data;
    dom.getData = _domMethods.getData;
    dom.replaceContent = _domMethods.replaceContent;
    dom.domComputed = _domMethods.domComputed;
    dom.maybe = _domMethods.maybe;
    dom.forEach = _domForEach.forEach;
    dom.Component = _domComponent.Component;
    dom.create = _domComponent.create;
    dom.createInit = _domComponent.createInit;
    dom.onElem = domevent.onElem;
    dom.on = domevent.on;
    dom.onMatchElem = domevent.onMatchElem;
    dom.onMatch = domevent.onMatch;
    dom.onKeyPressElem = domevent.onKeyPressElem;
    dom.onKeyPress = domevent.onKeyPress;
})(dom = exports.dom || (exports.dom = {}));

},{"./_domComponent":4,"./_domDispose":5,"./_domForEach":6,"./_domImpl":7,"./_domMethods":8,"./domevent":14}],14:[function(require,module,exports){
"use strict";
/**
 * domevent provides a way to listen to DOM events, similar to JQuery's `on()` function. Its
 * methods are also exposed via the dom.js module, as `dom.on()`, etc.
 *
 * It is typically used as an argument to the dom() function:
 *
 *    dom('div', dom.on('click', (event, elem) => { ... }));
 *
 * When the div is disposed, the listener is automatically removed.
 *
 * The underlying interface to listen to an event is this:
 *
 *    let listener = dom.onElem(elem, 'click', (event, elem) => { ... });
 *
 * The callback is called with the event and the element to which it was attached. Unlike in
 * JQuery, the callback's return value is ignored. Use event.stopPropagation() and
 * event.preventDefault() explicitly if needed.
 *
 * To stop listening:
 *
 *    listener.dispose();
 *
 * Disposing the listener returned by .onElem() is the only way to stop listening to an event. You
 * can use autoDispose to stop listening automatically when subscribing in a Disposable object:
 *
 *    this.autoDispose(domevent.onElem(document, 'mouseup', callback));
 *
 * To listen to descendants of an element matching the given selector (what JQuery calls
 * "delegated events", see http://api.jquery.com/on/):
 *
 *    dom('div', dom.onMatch('.selector', 'click', (event, elem) => { ... }));
 * or
 *    let lis = domevent.onMatchElem(elem, '.selector', 'click', (event, el) => { ... });
 *
 * In this usage, the element passed to the callback will be a DOM element matching the given
 * selector. If there are multiple matches, the callback is only called for the innermost one.
 *
 * If you need to remove the callback on first call, here's a useful pattern:
 *    let lis = domevent.onElem(elem, 'mouseup', e => { lis.dispose(); other_work(); });
 */
Object.defineProperty(exports, "__esModule", { value: true });
function _findMatch(inner, outer, selector) {
    for (let el = inner; el && el !== outer; el = el.parentElement) {
        if (el.matches(selector)) {
            return el;
        }
    }
    return null;
}
class DomEventListener {
    constructor(elem, eventType, callback, useCapture, selector) {
        this.elem = elem;
        this.eventType = eventType;
        this.callback = callback;
        this.useCapture = useCapture;
        this.selector = selector;
        this.elem.addEventListener(this.eventType, this, this.useCapture);
    }
    handleEvent(event) {
        const cb = this.callback;
        cb(event, this.elem);
    }
    dispose() {
        this.elem.removeEventListener(this.eventType, this, this.useCapture);
    }
}
class DomEventMatchListener extends DomEventListener {
    handleEvent(event) {
        const elem = _findMatch(event.target, this.elem, this.selector);
        if (elem) {
            const cb = this.callback;
            cb(event, elem);
        }
    }
}
/**
 * Listen to a DOM event. The `on()` variant takes no `elem` argument, and may be used as an
 * argument to dom() function.
 * @param {DOMElement} elem: DOM Element to listen to.
 * @param {String} eventType: Event type to listen for (e.g. 'click').
 * @param {Function} callback: Callback to call as `callback(event, elem)`, where elem is `elem`.
 * @param [Boolean] options.useCapture: Add the listener in the capture phase. This should very
 *    rarely be useful (e.g. JQuery doesn't even offer it as an option).
 * @returns {Object} Listener object whose .dispose() method will remove the event listener.
 */
function onElem(elem, eventType, callback, { useCapture = false } = {}) {
    return new DomEventListener(elem, eventType, callback, useCapture);
}
exports.onElem = onElem;
function on(eventType, callback, { useCapture = false } = {}) {
    // tslint:disable-next-line:no-unused-expression
    return (elem) => { new DomEventListener(elem, eventType, callback, useCapture); };
}
exports.on = on;
/**
 * Listen to a DOM event on descendants of the given elem matching the given selector. The
 * `onMatch()` variant takes no `elem` argument, and may be used as an argument to dom().
 * @param {DOMElement} elem: DOM Element to whose descendants to listen.
 * @param {String} selector: CSS selector string to filter elements that trigger this event.
 *    JQuery calls it "delegated events" (http://api.jquery.com/on/). The callback will only be
 *    called when the event occurs for an element matching the given selector. If there are
 *    multiple elements matching the selector, the callback is only called for the innermost one.
 * @param {String} eventType: Event type to listen for (e.g. 'click').
 * @param {Function} callback: Callback to call as `callback(event, elem)`, where elem is a
 *    descendent of `elem` which matches `selector`.
 * @param [Boolean] options.useCapture: Add the listener in the capture phase. This should very
 *    rarely be useful (e.g. JQuery doesn't even offer it as an option).
 * @returns {Object} Listener object whose .dispose() method will remove the event listener.
 */
function onMatchElem(elem, selector, eventType, callback, { useCapture = false } = {}) {
    return new DomEventMatchListener(elem, eventType, callback, useCapture, selector);
}
exports.onMatchElem = onMatchElem;
function onMatch(selector, eventType, callback, { useCapture = false } = {}) {
    // tslint:disable-next-line:no-unused-expression
    return (elem) => { new DomEventMatchListener(elem, eventType, callback, useCapture, selector); };
}
exports.onMatch = onMatch;
/**
 * Listen to key presses, with specified per-key callbacks. The `onKeyPress()` variant takes no
 * `elem` argument, and may be used as an argument to dom().
 *
 * Key names are listed at https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
 *
 * For example:
 *
 *    dom('input', ...
 *      dom.onKeyPress({
 *        Enter: (e, elem) => console.log("Enter pressed"),
 *        Escape: (e, elem) => console.log("Escape pressed"),
 *      })
 *    )
 */
function onKeyPressElem(elem, callbacks) {
    return onElem(elem, 'keypress', (e, _elem) => {
        const cb = callbacks[e.key];
        if (cb) {
            cb(e, _elem);
        }
    });
}
exports.onKeyPressElem = onKeyPressElem;
function onKeyPress(callbacks) {
    return (elem) => { onKeyPressElem(elem, callbacks); };
}
exports.onKeyPress = onKeyPress;

},{}],15:[function(require,module,exports){
"use strict";
/**
 * emit.js implements an Emitter class which emits events to a list of listeners. Listeners are
 * simply functions to call, and "emitting an event" just calls those functions.
 *
 * This is similar to Backbone events, with more focus on efficiency. Both inserting and removing
 * listeners is constant time.
 *
 * To create an emitter:
 *    let emitter = new Emitter();
 *
 * To add a listener:
 *    let listener = fooEmitter.addListener(callback);
 * To remove a listener:
 *    listener.dispose();
 *
 * The only way to remove a listener is to dispose the Listener object returned by addListener().
 * You can often use autoDispose to do this automatically when subscribing in a constructor:
 *    this.autoDispose(fooEmitter.addListener(this.onFoo, this));
 *
 * To emit an event, call emit() with any number of arguments:
 *    emitter.emit("hello", "world");
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Note about a possible alternative implementation.
//
// We could implement the same interface using an array of listeners. Certain issues apply, in
// particular with removing listeners from inside emit(), and in ensuring that removals are
// constant time on average. Such an implementation was attempted and timed. The result is that
// compared to the linked-list implementation here, add/remove combination could be made nearly
// twice faster (on average), while emit and add/remove/emit are consistently slightly slower.
//
// The implementation here was chosen based on those timings, and as the simpler one. For example,
// on one setup (macbook, node4, 5-listener queue), add+remove take 0.1us, while add+remove+emit
// take 3.82us. (In array-based implementation with same set up, add+remove is 0.06us, while
// add+remove+emit is 4.80us.)
// The private property name to hold next/prev pointers.
function _noop() { }
/**
 * This is an implementation of a doubly-linked list, with just the minimal functionality we need.
 */
class LLink {
    constructor() {
        this._next = null;
        this._prev = null;
        // This immediate circular reference might be undesirable for GC, but might not matter, and
        // makes the linked list implementation simpler and faster.
        this._next = this;
        this._prev = this;
    }
    isDisposed() {
        return !this._next;
    }
    _insertBefore(next, node) {
        const last = next._prev;
        last._next = node;
        next._prev = node;
        node._prev = last;
        node._next = next;
    }
    _removeNode(node) {
        if (node._prev) {
            node._prev._next = node._next;
            node._next._prev = node._prev;
        }
        node._prev = node._next = null;
    }
    _disposeList() {
        let node = this;
        let next = node._next;
        while (next !== null) {
            node._next = node._prev = null;
            node = next;
            next = node._next;
        }
    }
}
exports.LLink = LLink;
class Emitter extends LLink {
    /**
     * Constructs an Emitter object.
     */
    constructor() {
        super();
        this._changeCB = _noop;
        this._changeCBContext = undefined;
    }
    /**
     * Adds a listening callback to the list of functions to call on emit().
     * @param {Function} callback: Function to call.
     * @param {Object} optContext: Context for the function.
     * @returns {Listener} Listener object. Its dispose() method removes the callback from the list.
     */
    addListener(callback, optContext) {
        return new Listener(this, callback, optContext);
    }
    /**
     * Calls all listener callbacks, passing all arguments to each of them.
     */
    emit(...args) {
        Listener.callAll(this._next, this, args);
    }
    /**
     * Sets the single callback that would get called when a listener is added or removed.
     * @param {Function} changeCB(hasListeners): Function to call after a listener is added or
     *    removed. It's called with a boolean indicating whether this Emitter has any listeners.
     *    Pass in `null` to unset the callback.
     */
    setChangeCB(changeCB, optContext) {
        this._changeCB = changeCB || _noop;
        this._changeCBContext = optContext;
    }
    /**
     * Helper used by Listener class, but not intended for public usage.
     */
    _triggerChangeCB() {
        this._changeCB.call(this._changeCBContext, this.hasListeners());
    }
    /**
     * Returns whether this Emitter has any listeners.
     */
    hasListeners() {
        return this._next !== this;
    }
    /**
     * Disposes the Emitter. It breaks references between the emitter and all the items, allowing
     * for better garbage collection. It effectively disposes all current listeners.
     */
    dispose() {
        this._disposeList();
        this._changeCB = _noop;
        this._changeCBContext = undefined;
    }
}
exports.Emitter = Emitter;
/**
 * Listener object wraps a callback added to an Emitter, allowing for O(1) removal when the
 * listener is disposed.
 */
class Listener extends LLink {
    constructor(emitter, callback, context) {
        super();
        this.emitter = emitter;
        this.callback = callback;
        this.context = context;
        this._insertBefore(emitter, this);
        emitter._triggerChangeCB();
    }
    static callAll(begin, end, args) {
        while (begin !== end) {
            const lis = begin;
            lis.callback.call(lis.context, ...args);
            begin = lis._next;
        }
    }
    dispose() {
        if (this.isDisposed()) {
            return;
        }
        this._removeNode(this);
        this.emitter._triggerChangeCB();
    }
}
exports.Listener = Listener;

},{}],16:[function(require,module,exports){
"use strict";
/**
 * Grain.js observables and computeds are similar to (and mostly inspired by) those in
 * Knockout.js. In fact, they can work together.
 *
 *  import {fromKo} from 'kowrap'
 *
 *  fromKo(koObservable)
 *
 * returns a Grain.js observable that mirrors the passed-in Knockout observable (which may be a
 * computed as well). Similarly,
 *
 *  import {toKo} from 'kowrap';
 *  import * as ko from 'knockout';
 *
 *  toKo(ko, observable)
 *
 * returns a Knockout.js observable that mirrows the passed-in Grain observable or computed. Note
 * that toKo() mus tbe called with the knockout module as an argument. This is to avoid adding
 * knockout as a dependency of grainjs.
 *
 * In both cases, calling fromKo/toKo twice on the same observable will return the same wrapper,
 * and subscriptions and disposal are appropriately set up to make usage seamless.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const observable_1 = require("./observable");
const fromKoWrappers = new WeakMap();
const toKoWrappers = new WeakMap();
/**
 * Returns a Grain.js observable which mirrors a Knockout observable.
 */
function fromKo(koObservable) {
    const prevObs = fromKoWrappers.get(koObservable);
    if (prevObs) {
        return prevObs;
    }
    const newObs = observable_1.observable(koObservable.peek());
    fromKoWrappers.set(koObservable, newObs);
    koObservable.subscribe((val) => newObs.set(val));
    return newObs;
}
exports.fromKo = fromKo;
/**
 * Returns a Knockout observable which mirrors a Grain.js observable.
 */
function toKo(knockout, grainObs) {
    const prevKoObs = toKoWrappers.get(grainObs);
    if (prevKoObs) {
        return prevKoObs;
    }
    const newKoObs = knockout.observable(grainObs.get());
    toKoWrappers.set(grainObs, newKoObs);
    grainObs.addListener((val) => newKoObs(val));
    return newKoObs;
}
exports.toKo = toKo;

},{"./observable":18}],17:[function(require,module,exports){
"use strict";
/**
 * ObsArray extends a plain Observable to allow for more efficient observation of array changes.
 *
 * As for any array-valued Observable, when the contents of the observed array changes, the
 * listeners get called with new and previous values which are the same array. For simple changes,
 * such as those made with .push() and .splice() methods, ObsArray allows for more efficient
 * handling of the change by calling listeners with splice info in the third argument.
 *
 * This module also provides computedArray(), which allows mapping each item of an ObsArray
 * through a function, passing through splice info for efficient handling of small changes. It
 * also allows mapping an observable or a computed whose value is an ObsArray.
 *
 * There is no need or benefit in using computedArray() if you have a computed() that returns a
 * plain array. It is specifically for the case when you want to preserve the efficiency of
 * ObsArray when you map its values.
 *
 * Both ObsArray and ComputedArray may be used with disposable elements as their owners. E.g.
 *
 *    const arr = obsArray<D>();
 *    arr.push(D.create(arr, "x"), D.create(arr, "y"));
 *    arr.pop();      // Element "y" gets disposed.
 *    arr.dispose();  // Element "x" gets disposed.
 *
 *    const values = obsArray<string>();
 *    const compArr = computedArray<D>(values, (val, i, compArr) => D.create(compArr, val));
 *    values.push("foo", "bar");      // D("foo") and D("bar") get created
 *    values.pop();                   // D("bar") gets disposed.
 *    compArr.dispose();              // D("foo") gets disposed.
 *
 * Note that only the pattern above works: obsArray (or compArray) may only be used to take
 * ownership of those disposables that are added to it as array elements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const dispose_1 = require("./dispose");
const observable_1 = require("./observable");
const subscribe_1 = require("./subscribe");
/**
 * ObsArray<T> is essentially an array-valued observable. The main difference is that it may be
 * used as an owner for disposable array elements.
 */
class ObsArray extends observable_1.BaseObservable {
    constructor() {
        super(...arguments);
        this._ownedItems = undefined;
    }
    addListener(callback, optContext) {
        return super.addListener(callback, optContext);
    }
    autoDispose(value) {
        if (!this._ownedItems) {
            this._ownedItems = new Set();
        }
        this._ownedItems.add(value);
        return value;
    }
    dispose() {
        if (this._ownedItems) {
            for (const item of this.get()) {
                if (this._ownedItems.delete(item)) {
                    item.dispose();
                }
            }
            this._ownedItems = undefined;
        }
        super.dispose();
    }
    _setWithSplice(value, splice) {
        return this._setWithArg(value, splice);
    }
    _disposeOwned(splice) {
        if (!this._ownedItems) {
            return;
        }
        if (splice) {
            for (const item of splice.deleted) {
                if (this._ownedItems.delete(item)) {
                    item.dispose();
                }
            }
        }
        else {
            const oldOwnedItems = this._ownedItems;
            // Rebuild the _ownedItems array to have only the current items that were owned from before.
            this._ownedItems = new Set();
            for (const item of this.get()) {
                if (oldOwnedItems.delete(item)) {
                    this._ownedItems.add(item);
                }
            }
            // After removing current items, dispose any remaining owned items.
            for (const item of oldOwnedItems) {
                item.dispose();
            }
        }
    }
}
exports.ObsArray = ObsArray;
/**
 * MutableObsArray<T> adds array-like mutation methods which emit events with splice info, to
 * allow more efficient processing of such changes. It is created with obsArray<T>().
 */
class MutableObsArray extends ObsArray {
    push(...args) {
        const value = this.get();
        const start = value.length;
        const newLen = value.push(...args);
        this._setWithSplice(value, { start, numAdded: args.length, deleted: [] });
        return newLen;
    }
    pop() {
        const value = this.get();
        if (value.length === 0) {
            return undefined;
        }
        const ret = value.pop();
        this._setWithSplice(value, { start: value.length, numAdded: 0, deleted: [ret] });
        return ret;
    }
    unshift(...args) {
        const value = this.get();
        const newLen = value.unshift(...args);
        this._setWithSplice(value, { start: 0, numAdded: args.length, deleted: [] });
        return newLen;
    }
    shift() {
        const value = this.get();
        if (value.length === 0) {
            return undefined;
        }
        const ret = value.shift();
        this._setWithSplice(value, { start: 0, numAdded: 0, deleted: [ret] });
        return ret;
    }
    splice(start, deleteCount = Infinity, ...newValues) {
        const value = this.get();
        const len = value.length;
        start = Math.min(len, Math.max(0, start < 0 ? len + start : start));
        const deleted = value.splice(start, deleteCount, ...newValues);
        this._setWithSplice(value, { start, numAdded: newValues.length, deleted });
        return deleted;
    }
}
exports.MutableObsArray = MutableObsArray;
/**
 * Creates a new MutableObsArray with an optional initial value, defaulting to the empty array.
 * It is essentially the same as observable<T[]>, but with array-like mutation methods.
 */
function obsArray(value = []) {
    return new MutableObsArray(value);
}
exports.obsArray = obsArray;
/**
 * Returns true if val is an array-valued observable.
 */
function isObsArray(val) {
    return Array.isArray(val.get());
}
/**
 * See computedArray() below for documentation.
 */
class ComputedArray extends ObsArray {
    constructor(obsArr, _mapper) {
        super([]);
        this._mapper = _mapper;
        this._sub = isObsArray(obsArr) ?
            subscribe_1.subscribe(obsArr, (use) => this._syncMap(obsArr)) :
            subscribe_1.subscribe(obsArr, (use, obsArrayValue) => { use(obsArrayValue); return this._syncMap(obsArrayValue); });
    }
    dispose() {
        this._unsync();
        this._sub.dispose();
        super.dispose();
    }
    _syncMap(obsArr) {
        if (this._source !== obsArr) {
            this._unsync();
            this._listener = obsArr.addListener(this._recordChange, this);
            this._source = obsArr;
            this._rebuild(obsArr);
        }
        else if (this._lastSplice) {
            // If we are syncing to the same array as before and recorded a single splice, apply it now.
            this._applySplice(obsArr, this._lastSplice);
        }
        else {
            // If the full array changed or we had multiple splices, give up and rebuild.
            this._rebuild(obsArr);
        }
        this._lastSplice = undefined;
    }
    _unsync() {
        if (this._listener) {
            this._listener.dispose();
            this._listener = undefined;
            this._source = undefined;
        }
    }
    _rebuild(obsArr) {
        this.set(obsArr.get().map((item, i) => this._mapper.call(undefined, item, i, this)));
    }
    _applySplice(obsArr, change) {
        const sourceArray = obsArr.get();
        const newItems = [];
        for (let i = change.start, n = 0; n < change.numAdded; i++, n++) {
            newItems.push(this._mapper.call(undefined, sourceArray[i], i, this));
        }
        const items = this.get();
        const deleted = items.splice(change.start, change.deleted.length, ...newItems);
        this._setWithSplice(items, { start: change.start, numAdded: newItems.length, deleted });
    }
    _recordChange(newItems, oldItems, change) {
        // We don't attempt to handle efficiency multiple splices (it's quite hard in general, and
        // even harder to know that it's more efficient than rebuilding), so if _lastSplice is set, we
        // set it to a marker to mark the array for rebuilding.
        if (change && this._lastSplice === undefined) {
            this._lastSplice = change;
        }
        else {
            this._lastSplice = false; // This is a marker that a full rebuild is needed.
        }
    }
}
exports.ComputedArray = ComputedArray;
/**
 * Returns an ObsArray that maps all elements of the passed-in ObsArray through a mapper function.
 * Also accepts an observable (e.g. a computed) whose value is an ObsArray. Usage:
 *
 *    computedArray(obsArray, mapper)
 *
 * The result is entirely analogous to:
 *
 *     computed((use) => use(obsArray).map(mapper))       // for ObsArray
 *     computed((use) => use(use(obsArray)).map(mapper))  // for Observable<ObsArray>
 *
 * The benefit of computedArray() is that a small change to the source array (e.g. one item
 * added or removed), causes a small change to the mapped array, rather than a full rebuild.
 *
 * This is useful with an ObsArray or with an observable whose value is an ObsArray, and also
 * when the computed array owns its disposable items.
 *
 * Note that the mapper function is called with (item, index, array) as for a standard
 * array.map(), but that the index is only accurate at the time of the call, and will stop
 * reflecting the true index if more items are inserted into the array later.
 */
function computedArray(obsArr, mapper) {
    return new ComputedArray(obsArr, mapper);
}
exports.computedArray = computedArray;
/**
 * Returns a new observable representing an index into this array. It can be read and written, and
 * its value is clamped to be a valid index. The index is only null if the array is empty.
 *
 * As the array changes, the index is adjusted to continue pointing to the same element. If the
 * pointed element is deleted, the index is adjusted to after the deletion point.
 *
 * The returned observable has an additional .setLive(bool) method. While set to false, the
 * observable will not be adjusted as the array changes, except to keep it valid.
 */
function makeLiveIndex(owner, obsArr, initialIndex = 0) {
    return dispose_1.setDisposeOwner(owner, new LiveIndex(obsArr, initialIndex));
}
exports.makeLiveIndex = makeLiveIndex;
class LiveIndex extends observable_1.Observable {
    constructor(_obsArray, initialIndex = 0) {
        super(null);
        this._obsArray = _obsArray;
        this._isLive = true;
        this.set(initialIndex);
        this._listener = _obsArray.addListener(this._onArrayChange, this);
    }
    set(index) {
        // Clamp to [0, len) range of the observable array.
        const len = this._obsArray.get().length;
        super.set(len === 0 ? null : Math.max(0, Math.min(len - 1, index || 0)));
    }
    // Note that this feature comes from a rather obscure need, and it would be better if something
    // similar were possible without making it an explicit feature.
    setLive(value) {
        this._isLive = value;
    }
    dispose() {
        this._listener.dispose();
        super.dispose();
    }
    _onArrayChange(newItems, oldItems, change) {
        const idx = this.get();
        this.set(idx === null || !change ? 0 :
            // Adjust the index if it was beyond the deleted region.
            this._isLive && idx >= change.start + change.deleted.length ? idx + change.numAdded - change.deleted.length :
                // Adjust the index if it was inside the deleted region (and not replaced).
                this._isLive && idx >= change.start + change.numAdded ? change.start + change.numAdded :
                    idx);
    }
}
exports.LiveIndex = LiveIndex;

},{"./dispose":12,"./observable":18,"./subscribe":20}],18:[function(require,module,exports){
"use strict";
/**
 * observable.js implements an observable value, which lets other code subscribe to changes.
 *
 * E.g.
 *  let o = observable(17);
 *  o.get();          // 17
 *  o.addListener(foo);
 *  o.set("asdf");    // foo("asdf", 17) gets called.
 *  o.get();          // "asdf"
 *
 * To subscribe to changes, use obs.addListener(callback, context). The callback will get called
 * with (newValue, oldValue) as arguments.
 *
 * When you use observables within the body of a computed(), you can automatically create
 * subscriptions to them with the use(obs) function. E.g.
 *    let obs3 = computed(use => use(obs1) + use(obs2));
 * creates a computed observable `obs3` which is subscribed to changes to `obs1` and `obs2`.
 *
 * Note that unlike with knockout, use(obs) method requires an explicit `use` function, which is
 * always passed to a computed's read() callback for this purpose. This makes it explicit when a
 * dependency is created, and which observables the dependency connects.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const _computed_queue_1 = require("./_computed_queue");
const emit_1 = require("./emit");
var _computed_queue_2 = require("./_computed_queue");
exports.bundleChanges = _computed_queue_2.bundleChanges;
class BaseObservable {
    /**
     * Internal constructor for an Observable. You should use observable() function instead.
     */
    constructor(value) {
        this._onChange = new emit_1.Emitter();
        this._value = value;
    }
    /**
     * Returns the value of the observable. It is fast and does not create a subscription.
     * (It is similar to knockout's peek()).
     * @returns {Object} The current value of the observable.
     */
    get() { return this._value; }
    /**
     * Sets the value of the observable. If the value differs from the previously set one, then
     * listeners to this observable will get called with (newValue, oldValue) as arguments.
     * @param {Object} value: The new value to set.
     */
    set(value) {
        if (value !== this._value) {
            this.setAndTrigger(value);
        }
    }
    /**
     * Sets the value of the observable AND calls listeners even if the value is unchanged.
     */
    setAndTrigger(value) {
        const prev = this._value;
        this._value = value;
        this._onChange.emit(value, prev);
        this._disposeOwned();
        _computed_queue_1.compute();
    }
    /**
     * Adds a callback to listen to changes in the observable.
     * @param {Function} callback: Function, called on changes with (newValue, oldValue) arguments.
     * @param {Object} optContext: Context for the function.
     * @returns {Listener} Listener object. Its dispose() method removes the callback.
     */
    addListener(callback, optContext) {
        return this._onChange.addListener(callback, optContext);
    }
    /**
     * Returns whether this observable has any listeners.
     */
    hasListeners() {
        return this._onChange.hasListeners();
    }
    /**
     * Sets a single callback to be called when a listener is added or removed. It overwrites any
     * previously-set such callback.
     * @param {Function} changeCB(hasListeners): Function to call after a listener is added or
     *    removed. It's called with a boolean indicating whether this observable has any listeners.
     *    Pass in `null` to unset the callback.
     */
    setListenerChangeCB(changeCB, optContext) {
        this._onChange.setChangeCB(changeCB, optContext);
    }
    /**
     * Used by subscriptions to keep track of dependencies. An observable that has dependnecies,
     * such as a computed observable, would override this method.
     */
    _getDepItem() {
        return null;
    }
    /**
     * Disposes the observable.
     */
    dispose() {
        this._disposeOwned();
        this._onChange.dispose();
        this._value = undefined;
    }
    /**
     * Returns whether this observable is disposed.
     */
    isDisposed() {
        return this._onChange.isDisposed();
    }
    _disposeOwned(arg) { }
    /**
     * Allow derived classes to emit change events with an additional third argument describing the
     * change. It always emits the event without checking for value equality.
     */
    _setWithArg(value, arg) {
        const prev = this._value;
        this._value = value;
        this._onChange.emit(value, prev, arg);
        this._disposeOwned(arg);
        _computed_queue_1.compute();
    }
}
exports.BaseObservable = BaseObservable;
class Observable extends BaseObservable {
    constructor() {
        super(...arguments);
        this._owned = undefined;
    }
    // See module-level holder() function below for documentation.
    static holder(value) {
        const obs = new Observable(value);
        obs._owned = value;
        return obs;
    }
    /**
     * The use an observable for a disposable object, use it a DisposableOwner:
     *
     *    D.create(obs, ...args)                      // Preferred
     *    obs.autoDispose(D.create(null, ...args))    // Equivalent
     *
     * Either of these usages will set the observable to the newly created value. The observable
     * will dispose the owned value when it's set to another value, or when it itself is disposed.
     */
    autoDispose(value) {
        this.setAndTrigger(value);
        this._owned = value;
        return value;
    }
    _disposeOwned() {
        if (this._owned) {
            this._owned.dispose();
            this._owned = undefined;
        }
    }
}
exports.Observable = Observable;
/**
 * Creates a new Observable with the initial value of optValue if given or undefined if omitted.
 * @param {Object} optValue: The initial value to set.
 * @returns {Observable} The newly created observable.
 */
function observable(value) {
    return new Observable(value);
}
exports.observable = observable;
/**
 * Creates a new Observable with an initial disposable value owned by this observable, e.g.
 *
 *    const obs = obsHolder<D>(D.create(null, ...args));
 *
 * This is needed because using simply observable<D>(value) would not cause the observable to take
 * ownership of value (i.e. to dispose it later). This function is a less hacky equivalent to:
 *
 *    const obs = observable<D>(null as any);
 *    D.create(obs, ...args);
 *
 * To allow nulls, use observable<D|null>(null); then the obsHolder() constructor is not needed.
 */
function obsHolder(value) {
    return Observable.holder(value);
}
exports.obsHolder = obsHolder;

},{"./_computed_queue":3,"./emit":15}],19:[function(require,module,exports){
"use strict";
/**
 * In-code styling for DOM components, inspired by Reacts Styled Components.
 *
 * Usage:
 *    const title = styled('h1', `
 *      font-size: 1.5em;
 *      text-align: center;
 *      color: palevioletred;
 *    `);
 *
 *    const wrapper = styled('section', `
 *      padding: 4em;
 *      background: papayawhip;
 *    `);
 *
 *    wrapper(title('Hello world'))
 *
 * This generates class names for title and wrapper, adds the styles to the document on first use,
 * and the result is equivalent to:
 *
 *    dom(`section.${wrapper.className}`, dom(`h1.${title.className}`, 'Hello world'));
 *
 * Calls to styled() should happen at the top level, at import time, in order to register all
 * styles upfront. Actual work happens the first time a style is needed to create an element.
 * Calling styled() elsewhere than at top level is wasteful and bad for performance.
 *
 * You may create a style that modifies an existing styled() or other component, e.g.
 *
 *    const title2 = styled(title, `font-size: 1rem; color: red;`);
 *
 * Calling title2('Foo') becomes equivalent to dom(`h1.${title.className}.${title2.className}`).
 *
 * Styles may incorporate other related styles by nesting them under the main one as follows:
 *
 *     const myButton = styled('button', `
 *       border-radius: 0.5rem;
 *       border: 1px solid grey;
 *       font-size: 1rem;
 *
 *       &:active {
 *         background: lightblue;
 *       }
 *       &-small {
 *         font-size: 0.6rem;
 *       }
 *     `);
 *
 * In nested styles, ampersand (&) gets replaced with the generated .className of the main element.
 *
 * The resulting styled component provides a .cls() helper to simplify using prefixed classes. It
 * behaves as dom.cls(), but prefixes the class names with the generated className of the main
 * element. E.g. for the example above,
 *
 *      myButton(myButton.cls('-small'), 'Test')
 *
 * creates a button with both the myButton style above, and the style specified under "&-small".
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Use the browser globals in a way that allows replacing them with mocks in tests.
const browserGlobals_1 = require("./browserGlobals");
const dom_1 = require("./dom");
function styled(creator, styles) {
    // Note that we intentionally minimize the work done when styled() is called; it's better to do
    // any needed work on first use. That's when we will actually build the css rules.
    const style = new StylePiece(styles);
    // Creator function reflects the input, with only the addition of style.use() at the end. Note
    // that it needs to be at the end because creator() might take special initial arguments.
    const newCreator = (typeof creator === 'string') ?
        (...args) => dom_1.dom(creator, ...args, style.use()) :
        (...args) => creator(...args, style.use());
    return Object.assign(newCreator, {
        className: style.className,
        cls: dom_1.dom.clsPrefix.bind(null, style.className),
    });
}
exports.styled = styled;
function createCssRules(className, styles) {
    const nestedRules = [];
    // Parse out nested styles. Replacing them by empty string in the main section, and add them to
    // nestedRules array to be joined up at the end. Replace & with .className.
    const mainRules = styles.replace(/([^;]*)\s*{([^}]*)\s*}/g, (match, selector, rules) => {
        const fullSelector = selector.replace(/&/g, '.' + className);
        nestedRules.push(`${fullSelector} {${rules}}`);
        return '';
    });
    // Actual styles to include into the generated stylesheet.
    return `.${className} {${mainRules}}\n` + nestedRules.join('\n');
}
class StylePiece {
    constructor(_styles) {
        this._styles = _styles;
        this._mounted = false;
        this.className = StylePiece._nextClassName();
        StylePiece._unmounted.add(this);
    }
    // Generate a new css class name.
    static _nextClassName() { return `_grain${this._next++}`; }
    // Mount all unmounted StylePieces, and clear the _unmounted map.
    static _mountAll() {
        const sheet = Array.from(this._unmounted, (p) => createCssRules(p.className, p._styles))
            .join('\n\n');
        browserGlobals_1.G.document.head.appendChild(dom_1.dom('style', sheet));
        for (const piece of this._unmounted) {
            piece._mounted = true;
        }
        this._unmounted.clear();
    }
    use() {
        if (!this._mounted) {
            StylePiece._mountAll();
        }
        return (elem) => { elem.classList.add(this.className); };
    }
}
// Index of next auto-generated css class name.
StylePiece._next = 1;
// Set of all StylePieces created but not yet mounted.
StylePiece._unmounted = new Set();

},{"./browserGlobals":10,"./dom":13}],20:[function(require,module,exports){
"use strict";
/**
 * subscribe.js implements subscriptions to several observables at once.
 *
 * E.g. if we have some existing observables (which may be instances of `computed`),
 * we can subscribe to them explicitly:
 *    let obs1 = observable(5), obs2 = observable(12);
 *    subscribe(obs1, obs2, (use, v1, v2) => console.log(v1, v2));
 *
 * or implicitly by using `use(obs)` function, which allows dynamic subscriptions:
 *    subscribe(use => console.log(use(obs1), use(obs2)));
 *
 * In either case, if obs1 or obs2 is changed, the callbacks will get called automatically.
 *
 * Creating a subscription allows any number of dependencies to be specified explicitly, and their
 * values will be passed to the callback(). These may be combined with automatic dependencies
 * detected using use(). Note that constructor dependencies have less overhead.
 *
 *    subscribe(...deps, ((use, ...depValues) => READ_CALLBACK));
 */
Object.defineProperty(exports, "__esModule", { value: true });
const _computed_queue_1 = require("./_computed_queue");
// Constant empty array, which we use to avoid allocating new read-only empty arrays.
const emptyArray = [];
class Subscription {
    /**
     * Internal constructor for a Subscription. You should use subscribe() function instead.
     * The last owner argument is used by computed() to make itself available as the .owner property
     * of the 'use' function that gets passed to the callback.
     */
    constructor(callback, dependencies, owner) {
        this._depItem = new _computed_queue_1.DepItem(this._evaluate, this);
        this._dependencies = dependencies.length > 0 ? dependencies : emptyArray;
        this._depListeners = dependencies.length > 0 ? dependencies.map((obs) => this._subscribeTo(obs)) : emptyArray;
        this._dynDeps = new Map(); // Maps dependent observable to its Listener object.
        this._callback = callback;
        this._useFunc = this._useDependency.bind(this);
        if (owner) {
            this._useFunc.owner = owner;
        }
        this._evaluate();
    }
    /**
     * Disposes the computed, unsubscribing it from all observables it depends on.
     */
    dispose() {
        this._callback = null;
        for (const lis of this._depListeners) {
            lis.dispose();
        }
        for (const lis of this._dynDeps.values()) {
            lis.dispose();
        }
    }
    /**
     * For use by computed(): returns this subscription's hook into the _computed_queue.
     */
    _getDepItem() { return this._depItem; }
    /**
     * @private
     * Gets called when the callback calls `use(obs)` for an observable. It creates a
     * subscription to `obs` if one doesn't yet exist.
     * @param {Observable} obs: The observable being used as a dependency.
     */
    _useDependency(obs) {
        let listener = this._dynDeps.get(obs);
        if (!listener) {
            listener = this._subscribeTo(obs);
            this._dynDeps.set(obs, listener);
        }
        listener._inUse = true;
        this._depItem.useDep(obs._getDepItem());
        return obs.get();
    }
    /**
     * @private
     * Calls the callback() with appropriate args, and updates subscriptions when it is done.
     * I.e. adds dynamic subscriptions created via `use(obs)`, and disposes those no longer used.
     */
    _evaluate() {
        if (this._callback === null) {
            return;
        } // Means this Subscription has been disposed.
        try {
            // Note that this is faster than using .map().
            const readArgs = [this._useFunc];
            for (let i = 0, len = this._dependencies.length; i < len; i++) {
                readArgs[i + 1] = this._dependencies[i].get();
                this._depItem.useDep(this._dependencies[i]._getDepItem());
            }
            return this._callback.apply(undefined, readArgs);
        }
        finally {
            this._dynDeps.forEach((listener, obs) => {
                if (listener._inUse) {
                    listener._inUse = false;
                }
                else {
                    this._dynDeps.delete(obs);
                    listener.dispose();
                }
            });
        }
    }
    /**
     * @private
     * Subscribes this computed to another observable that it depends on.
     * @param {Observable} obs: The observable to subscribe to.
     * @returns {Listener} Listener object.
     */
    _subscribeTo(obs) {
        return obs.addListener(this._enqueue, this);
    }
    /**
     * @private
     * Adds this item to the recompute queue.
     */
    _enqueue() {
        this._depItem.enqueue();
    }
}
exports.Subscription = Subscription;
/**
 * Creates a new Subscription.
 * @param {Observable} ...observables: The initial params, of which there may be zero or more, are
 *    observables on which this computed depends. When any of them change, the callback()
 *    will be called with the values of these observables as arguments.
 * @param {Function} callback: will be called with arguments (use, ...values), i.e. the
 *    `use` function and values for all of the ...observables that precede this argument.
 *    This callback is called immediately, and whenever any dependency changes.
 * @returns {Subscription} The new subscription which may be disposed to unsubscribe.
 */
function subscribe(...args) {
    const cb = args.pop();
    // The cast helps ensure that Observable is compatible with ISubscribable abstraction that we use.
    return new Subscription(cb, args);
}
exports.subscribe = subscribe;

},{"./_computed_queue":3}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Returns f such that f() calls func(...boundArgs), i.e. optimizes `() => func(...boundArgs)`.
 * It is faster on node6 by 57-92%.
 */
function bindB(func, b) {
    switch (b.length) {
        case 0: return () => func();
        case 1: return () => func(b[0]);
        case 2: return () => func(b[0], b[1]);
        case 3: return () => func(b[0], b[1], b[2]);
        case 4: return () => func(b[0], b[1], b[2], b[3]);
        case 5: return () => func(b[0], b[1], b[2], b[3], b[4]);
        case 6: return () => func(b[0], b[1], b[2], b[3], b[4], b[5]);
        case 7: return () => func(b[0], b[1], b[2], b[3], b[4], b[5], b[6]);
        case 8: return () => func(b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]);
        default: return () => func.apply(undefined, b);
    }
}
exports.bindB = bindB;
/**
 * Returns f such that f(unboundArg) calls func(unboundArg, ...boundArgs).
 * I.e. optimizes `(arg) => func(arg, ...boundArgs)`.
 * It is faster on node6 by 0-92%.
 */
function bindUB(func, b) {
    switch (b.length) {
        case 0: return (arg) => func(arg);
        case 1: return (arg) => func(arg, b[0]);
        case 2: return (arg) => func(arg, b[0], b[1]);
        case 3: return (arg) => func(arg, b[0], b[1], b[2]);
        case 4: return (arg) => func(arg, b[0], b[1], b[2], b[3]);
        case 5: return (arg) => func(arg, b[0], b[1], b[2], b[3], b[4]);
        case 6: return (arg) => func(arg, b[0], b[1], b[2], b[3], b[4], b[5]);
        case 7: return (arg) => func(arg, b[0], b[1], b[2], b[3], b[4], b[5], b[6]);
        case 8: return (arg) => func(arg, b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]);
        default: return (arg) => func(arg, ...b);
    }
}
exports.bindUB = bindUB;
/**
 * Returns f such that f(unboundArg) calls func(...boundArgs, unboundArg).
 * I.e. optimizes `(arg) => func(...boundArgs, arg)`.
 * It is faster on node6 by 0-92%.
 */
function bindBU(func, b) {
    switch (b.length) {
        case 0: return (arg) => func(arg);
        case 1: return (arg) => func(b[0], arg);
        case 2: return (arg) => func(b[0], b[1], arg);
        case 3: return (arg) => func(b[0], b[1], b[2], arg);
        case 4: return (arg) => func(b[0], b[1], b[2], b[3], arg);
        case 5: return (arg) => func(b[0], b[1], b[2], b[3], b[4], arg);
        case 6: return (arg) => func(b[0], b[1], b[2], b[3], b[4], b[5], arg);
        case 7: return (arg) => func(b[0], b[1], b[2], b[3], b[4], b[5], b[6], arg);
        case 8: return (arg) => func(b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], arg);
        default: return (arg) => func(...b, arg);
    }
}
exports.bindBU = bindBU;

},{}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * General INPUT widget.
 */
const index_1 = require("../../index");
/**
 * Creates a input element tied to the given observable. The required options argument allows
 * controlling the behavior, see IInputOptions for details.
 *
 * This is intended for string input elements, with "type" such as text, email, url, password,
 * number, tel.
 *
 * Note that every change to the observable will affect the input element, but not every change to
 * the input element will affect the observable. Specifically, unless {onInput: true} is set, the
 * visible content may differ from the observable until the element loses focus or Enter is hit.
 *
 * Example usage:
 *    input(obs, {}, {type: 'text', placeholder: 'Your name...'});
 *    input(obs, {isValid: isValidObs}, {type: 'email', placeholder: 'Your email...'});
 *    input(obs, {onInput: true}, {type: 'text'});
 */
function input(obs, options, ...args) {
    const isValid = options.isValid;
    function setValue(_elem) {
        const elem = _elem;
        index_1.bundleChanges(() => {
            obs.set(elem.value);
            if (isValid) {
                isValid.set(elem.validity.valid);
            }
        });
    }
    return index_1.dom('input', ...args, index_1.dom.prop('value', obs), (isValid ?
        (elem) => index_1.dom.autoDisposeElem(elem, index_1.subscribe(obs, (use) => isValid.set(elem.checkValidity()))) :
        null), options.onInput ? index_1.dom.on('input', (e, elem) => setValue(elem)) : null, index_1.dom.on('change', (e, elem) => setValue(elem)), index_1.dom.onKeyPress({ Enter: (e, elem) => setValue(elem) }));
}
exports.input = input;

},{"../../index":1}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Select dropdown widget.
 */
const index_1 = require("../../index");
function unwrapMaybeObsArray(array) {
    return Array.isArray(array) ? array : array.get();
}
function getOptionValue(option) {
    return (typeof option === "string") ?
        option : option.value;
}
/**
 * Creates a select dropdown widget. The observable `obs` reflects the value of the selected
 * option, and `optionArray` is an array (regular or observable) of option values and labels.
 * These may be either strings, or {label, value, disabled} objects.
 *
 * The type of value may be any type at all; it is opaque to this widget.
 *
 * If obs is set to an invalid or disabled value, then defLabel option is used to determine the
 * label that the select box will show, blank by default.
 *
 * Usage:
 *    const fruit = observable("apple");
 *    select(fruit, ["apple", "banana", "mango"]);
 *
 *    const employee = observable(17);
 *    const employees = obsArray<IOption<number>>([
 *      {value: 12, label: "Bob", disabled: true},
 *      {value: 17, label: "Alice"},
 *      {value: 21, label: "Eve"},
 *    ]);
 *    select(employee, employees, {defLabel: "Select employee:"});
 */
function select(obs, optionArray, options = {}) {
    const { defLabel = "" } = options;
    return index_1.dom('select', 
    // Include a hidden option to represent a default value. This one gets shown when none of the
    // options are selected. This is more consistent when showing the first valid option.
    index_1.dom('option', index_1.dom.hide(true), defLabel), 
    // Create all the option elements.
    index_1.dom.forEach(optionArray, (option) => {
        const obj = (typeof option === "string") ?
            { value: option, label: option } : option;
        // Note we only set 'selected' when an <option> is created; we are not subscribing to obs.
        // This is to reduce the amount of subscriptions, esp. when number of options is large.
        return index_1.dom('option', {
            disabled: obj.disabled,
            selected: obj.value === obs.get(),
        }, obj.label);
    }), 
    // When obs changes, update select's value; we do it after <options> have been created.
    // Note that autoDisposeElem ensures the subscription is disposed with the 'select' element.
    (elem) => index_1.dom.autoDisposeElem(elem, index_1.subscribe(obs, (use, obsValue) => {
        const arr = unwrapMaybeObsArray(optionArray);
        const index = arr.findIndex((item) => getOptionValue(item) === obsValue);
        elem.selectedIndex = index + 1; // +1 for default option
    })), 
    // When user picks a new item, use its value to update the observable.
    index_1.dom.on('change', (e, elem) => {
        const index = elem.selectedIndex;
        const item = unwrapMaybeObsArray(optionArray)[index - 1]; // -1 for default option
        // It should be impossible for the user to select an invalid option, but check just in case.
        if (item !== undefined) {
            obs.set(getOptionValue(item));
        }
    }));
}
exports.select = select;

},{"../../index":1}]},{},[1])(1)
});
