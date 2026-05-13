import { E as countColumn, T as combineConfig, b as StateField, c as EditorState, f as Prec, h as RangeSetBuilder, l as Facet, m as RangeSet, v as StateEffect } from "./dist-Hef7Z_Rg.js";
import { $ as StyleModule, T as gutter, V as logException, a as Decoration, c as GutterMarker, d as ViewPlugin, o as Direction, p as WidgetType, s as EditorView } from "./dist-CJ3dJb85.js";
//#region node_modules/@lezer/common/dist/index.js
/**
The default maximum length of a `TreeBuffer` node.
*/
var DefaultBufferLength = 1024;
var nextPropID = 0;
var Range = class {
	constructor(from, to) {
		this.from = from;
		this.to = to;
	}
};
/**
Each [node type](#common.NodeType) or [individual tree](#common.Tree)
can have metadata associated with it in props. Instances of this
class represent prop names.
*/
var NodeProp = class {
	/**
	Create a new node prop type.
	*/
	constructor(config = {}) {
		this.id = nextPropID++;
		this.perNode = !!config.perNode;
		this.deserialize = config.deserialize || (() => {
			throw new Error("This node type doesn't define a deserialize function");
		});
		this.combine = config.combine || null;
	}
	/**
	This is meant to be used with
	[`NodeSet.extend`](#common.NodeSet.extend) or
	[`LRParser.configure`](#lr.ParserConfig.props) to compute
	prop values for each node type in the set. Takes a [match
	object](#common.NodeType^match) or function that returns undefined
	if the node type doesn't get this prop, and the prop's value if
	it does.
	*/
	add(match) {
		if (this.perNode) throw new RangeError("Can't add per-node props to node types");
		if (typeof match != "function") match = NodeType.match(match);
		return (type) => {
			let result = match(type);
			return result === void 0 ? null : [this, result];
		};
	}
};
/**
Prop that is used to describe matching delimiters. For opening
delimiters, this holds an array of node names (written as a
space-separated string when declaring this prop in a grammar)
for the node types of closing delimiters that match it.
*/
NodeProp.closedBy = new NodeProp({ deserialize: (str) => str.split(" ") });
/**
The inverse of [`closedBy`](#common.NodeProp^closedBy). This is
attached to closing delimiters, holding an array of node names
of types of matching opening delimiters.
*/
NodeProp.openedBy = new NodeProp({ deserialize: (str) => str.split(" ") });
/**
Used to assign node types to groups (for example, all node
types that represent an expression could be tagged with an
`"Expression"` group).
*/
NodeProp.group = new NodeProp({ deserialize: (str) => str.split(" ") });
/**
Attached to nodes to indicate these should be
[displayed](https://codemirror.net/docs/ref/#language.syntaxTree)
in a bidirectional text isolate, so that direction-neutral
characters on their sides don't incorrectly get associated with
surrounding text. You'll generally want to set this for nodes
that contain arbitrary text, like strings and comments, and for
nodes that appear _inside_ arbitrary text, like HTML tags. When
not given a value, in a grammar declaration, defaults to
`"auto"`.
*/
NodeProp.isolate = new NodeProp({ deserialize: (value) => {
	if (value && value != "rtl" && value != "ltr" && value != "auto") throw new RangeError("Invalid value for isolate: " + value);
	return value || "auto";
} });
/**
The hash of the [context](#lr.ContextTracker.constructor)
that the node was parsed in, if any. Used to limit reuse of
contextual nodes.
*/
NodeProp.contextHash = new NodeProp({ perNode: true });
/**
The distance beyond the end of the node that the tokenizer
looked ahead for any of the tokens inside the node. (The LR
parser only stores this when it is larger than 25, for
efficiency reasons.)
*/
NodeProp.lookAhead = new NodeProp({ perNode: true });
/**
This per-node prop is used to replace a given node, or part of a
node, with another tree. This is useful to include trees from
different languages in mixed-language parsers.
*/
NodeProp.mounted = new NodeProp({ perNode: true });
/**
A mounted tree, which can be [stored](#common.NodeProp^mounted) on
a tree node to indicate that parts of its content are
represented by another tree.
*/
var MountedTree = class {
	constructor(tree, overlay, parser, bracketed = false) {
		this.tree = tree;
		this.overlay = overlay;
		this.parser = parser;
		this.bracketed = bracketed;
	}
	/**
	@internal
	*/
	static get(tree) {
		return tree && tree.props && tree.props[NodeProp.mounted.id];
	}
};
var noProps = Object.create(null);
/**
Each node in a syntax tree has a node type associated with it.
*/
var NodeType = class NodeType {
	/**
	@internal
	*/
	constructor(name, props, id, flags = 0) {
		this.name = name;
		this.props = props;
		this.id = id;
		this.flags = flags;
	}
	/**
	Define a node type.
	*/
	static define(spec) {
		let props = spec.props && spec.props.length ? Object.create(null) : noProps;
		let flags = (spec.top ? 1 : 0) | (spec.skipped ? 2 : 0) | (spec.error ? 4 : 0) | (spec.name == null ? 8 : 0);
		let type = new NodeType(spec.name || "", props, spec.id, flags);
		if (spec.props) for (let src of spec.props) {
			if (!Array.isArray(src)) src = src(type);
			if (src) {
				if (src[0].perNode) throw new RangeError("Can't store a per-node prop on a node type");
				props[src[0].id] = src[1];
			}
		}
		return type;
	}
	/**
	Retrieves a node prop for this type. Will return `undefined` if
	the prop isn't present on this node.
	*/
	prop(prop) {
		return this.props[prop.id];
	}
	/**
	True when this is the top node of a grammar.
	*/
	get isTop() {
		return (this.flags & 1) > 0;
	}
	/**
	True when this node is produced by a skip rule.
	*/
	get isSkipped() {
		return (this.flags & 2) > 0;
	}
	/**
	Indicates whether this is an error node.
	*/
	get isError() {
		return (this.flags & 4) > 0;
	}
	/**
	When true, this node type doesn't correspond to a user-declared
	named node, for example because it is used to cache repetition.
	*/
	get isAnonymous() {
		return (this.flags & 8) > 0;
	}
	/**
	Returns true when this node's name or one of its
	[groups](#common.NodeProp^group) matches the given string.
	*/
	is(name) {
		if (typeof name == "string") {
			if (this.name == name) return true;
			let group = this.prop(NodeProp.group);
			return group ? group.indexOf(name) > -1 : false;
		}
		return this.id == name;
	}
	/**
	Create a function from node types to arbitrary values by
	specifying an object whose property names are node or
	[group](#common.NodeProp^group) names. Often useful with
	[`NodeProp.add`](#common.NodeProp.add). You can put multiple
	names, separated by spaces, in a single property name to map
	multiple node names to a single value.
	*/
	static match(map) {
		let direct = Object.create(null);
		for (let prop in map) for (let name of prop.split(" ")) direct[name] = map[prop];
		return (node) => {
			for (let groups = node.prop(NodeProp.group), i = -1; i < (groups ? groups.length : 0); i++) {
				let found = direct[i < 0 ? node.name : groups[i]];
				if (found) return found;
			}
		};
	}
};
/**
An empty dummy node type to use when no actual type is available.
*/
NodeType.none = new NodeType("", Object.create(null), 0, 8);
/**
A node set holds a collection of node types. It is used to
compactly represent trees by storing their type ids, rather than a
full pointer to the type object, in a numeric array. Each parser
[has](#lr.LRParser.nodeSet) a node set, and [tree
buffers](#common.TreeBuffer) can only store collections of nodes
from the same set. A set can have a maximum of 2**16 (65536) node
types in it, so that the ids fit into 16-bit typed array slots.
*/
var NodeSet = class NodeSet {
	/**
	Create a set with the given types. The `id` property of each
	type should correspond to its position within the array.
	*/
	constructor(types) {
		this.types = types;
		for (let i = 0; i < types.length; i++) if (types[i].id != i) throw new RangeError("Node type ids should correspond to array positions when creating a node set");
	}
	/**
	Create a copy of this set with some node properties added. The
	arguments to this method can be created with
	[`NodeProp.add`](#common.NodeProp.add).
	*/
	extend(...props) {
		let newTypes = [];
		for (let type of this.types) {
			let newProps = null;
			for (let source of props) {
				let add = source(type);
				if (add) {
					if (!newProps) newProps = Object.assign({}, type.props);
					let value = add[1], prop = add[0];
					if (prop.combine && prop.id in newProps) value = prop.combine(newProps[prop.id], value);
					newProps[prop.id] = value;
				}
			}
			newTypes.push(newProps ? new NodeType(type.name, newProps, type.id, type.flags) : type);
		}
		return new NodeSet(newTypes);
	}
};
var CachedNode = /* @__PURE__ */ new WeakMap(), CachedInnerNode = /* @__PURE__ */ new WeakMap();
/**
Options that control iteration. Can be combined with the `|`
operator to enable multiple ones.
*/
var IterMode;
(function(IterMode) {
	/**
	When enabled, iteration will only visit [`Tree`](#common.Tree)
	objects, not nodes packed into
	[`TreeBuffer`](#common.TreeBuffer)s.
	*/
	IterMode[IterMode["ExcludeBuffers"] = 1] = "ExcludeBuffers";
	/**
	Enable this to make iteration include anonymous nodes (such as
	the nodes that wrap repeated grammar constructs into a balanced
	tree).
	*/
	IterMode[IterMode["IncludeAnonymous"] = 2] = "IncludeAnonymous";
	/**
	By default, regular [mounted](#common.NodeProp^mounted) nodes
	replace their base node in iteration. Enable this to ignore them
	instead.
	*/
	IterMode[IterMode["IgnoreMounts"] = 4] = "IgnoreMounts";
	/**
	This option only applies in
	[`enter`](#common.SyntaxNode.enter)-style methods. It tells the
	library to not enter mounted overlays if one covers the given
	position.
	*/
	IterMode[IterMode["IgnoreOverlays"] = 8] = "IgnoreOverlays";
	/**
	When set, positions on the boundary of a mounted overlay tree
	that has its [`bracketed`](#common.NestedParse.bracketed) flag
	set will enter that tree regardless of side. Only supported in
	[`enter`](#common.SyntaxNode.enter), not in cursors.
	*/
	IterMode[IterMode["EnterBracketed"] = 16] = "EnterBracketed";
})(IterMode || (IterMode = {}));
/**
A piece of syntax tree. There are two ways to approach these
trees: the way they are actually stored in memory, and the
convenient way.

Syntax trees are stored as a tree of `Tree` and `TreeBuffer`
objects. By packing detail information into `TreeBuffer` leaf
nodes, the representation is made a lot more memory-efficient.

However, when you want to actually work with tree nodes, this
representation is very awkward, so most client code will want to
use the [`TreeCursor`](#common.TreeCursor) or
[`SyntaxNode`](#common.SyntaxNode) interface instead, which provides
a view on some part of this data structure, and can be used to
move around to adjacent nodes.
*/
var Tree = class Tree {
	/**
	Construct a new tree. See also [`Tree.build`](#common.Tree^build).
	*/
	constructor(type, children, positions, length, props) {
		this.type = type;
		this.children = children;
		this.positions = positions;
		this.length = length;
		/**
		@internal
		*/
		this.props = null;
		if (props && props.length) {
			this.props = Object.create(null);
			for (let [prop, value] of props) this.props[typeof prop == "number" ? prop : prop.id] = value;
		}
	}
	/**
	@internal
	*/
	toString() {
		let mounted = MountedTree.get(this);
		if (mounted && !mounted.overlay) return mounted.tree.toString();
		let children = "";
		for (let ch of this.children) {
			let str = ch.toString();
			if (str) {
				if (children) children += ",";
				children += str;
			}
		}
		return !this.type.name ? children : (/\W/.test(this.type.name) && !this.type.isError ? JSON.stringify(this.type.name) : this.type.name) + (children.length ? "(" + children + ")" : "");
	}
	/**
	Get a [tree cursor](#common.TreeCursor) positioned at the top of
	the tree. Mode can be used to [control](#common.IterMode) which
	nodes the cursor visits.
	*/
	cursor(mode = 0) {
		return new TreeCursor(this.topNode, mode);
	}
	/**
	Get a [tree cursor](#common.TreeCursor) pointing into this tree
	at the given position and side (see
	[`moveTo`](#common.TreeCursor.moveTo).
	*/
	cursorAt(pos, side = 0, mode = 0) {
		let cursor = new TreeCursor(CachedNode.get(this) || this.topNode);
		cursor.moveTo(pos, side);
		CachedNode.set(this, cursor._tree);
		return cursor;
	}
	/**
	Get a [syntax node](#common.SyntaxNode) object for the top of the
	tree.
	*/
	get topNode() {
		return new TreeNode(this, 0, 0, null);
	}
	/**
	Get the [syntax node](#common.SyntaxNode) at the given position.
	If `side` is -1, this will move into nodes that end at the
	position. If 1, it'll move into nodes that start at the
	position. With 0, it'll only enter nodes that cover the position
	from both sides.
	
	Note that this will not enter
	[overlays](#common.MountedTree.overlay), and you often want
	[`resolveInner`](#common.Tree.resolveInner) instead.
	*/
	resolve(pos, side = 0) {
		let node = resolveNode(CachedNode.get(this) || this.topNode, pos, side, false);
		CachedNode.set(this, node);
		return node;
	}
	/**
	Like [`resolve`](#common.Tree.resolve), but will enter
	[overlaid](#common.MountedTree.overlay) nodes, producing a syntax node
	pointing into the innermost overlaid tree at the given position
	(with parent links going through all parent structure, including
	the host trees).
	*/
	resolveInner(pos, side = 0) {
		let node = resolveNode(CachedInnerNode.get(this) || this.topNode, pos, side, true);
		CachedInnerNode.set(this, node);
		return node;
	}
	/**
	In some situations, it can be useful to iterate through all
	nodes around a position, including those in overlays that don't
	directly cover the position. This method gives you an iterator
	that will produce all nodes, from small to big, around the given
	position.
	*/
	resolveStack(pos, side = 0) {
		return stackIterator(this, pos, side);
	}
	/**
	Iterate over the tree and its children, calling `enter` for any
	node that touches the `from`/`to` region (if given) before
	running over such a node's children, and `leave` (if given) when
	leaving the node. When `enter` returns `false`, that node will
	not have its children iterated over (or `leave` called).
	*/
	iterate(spec) {
		let { enter, leave, from = 0, to = this.length } = spec;
		let mode = spec.mode || 0, anon = (mode & IterMode.IncludeAnonymous) > 0;
		for (let c = this.cursor(mode | IterMode.IncludeAnonymous);;) {
			let entered = false;
			if (c.from <= to && c.to >= from && (!anon && c.type.isAnonymous || enter(c) !== false)) {
				if (c.firstChild()) continue;
				entered = true;
			}
			for (;;) {
				if (entered && leave && (anon || !c.type.isAnonymous)) leave(c);
				if (c.nextSibling()) break;
				if (!c.parent()) return;
				entered = true;
			}
		}
	}
	/**
	Get the value of the given [node prop](#common.NodeProp) for this
	node. Works with both per-node and per-type props.
	*/
	prop(prop) {
		return !prop.perNode ? this.type.prop(prop) : this.props ? this.props[prop.id] : void 0;
	}
	/**
	Returns the node's [per-node props](#common.NodeProp.perNode) in a
	format that can be passed to the [`Tree`](#common.Tree)
	constructor.
	*/
	get propValues() {
		let result = [];
		if (this.props) for (let id in this.props) result.push([+id, this.props[id]]);
		return result;
	}
	/**
	Balance the direct children of this tree, producing a copy of
	which may have children grouped into subtrees with type
	[`NodeType.none`](#common.NodeType^none).
	*/
	balance(config = {}) {
		return this.children.length <= 8 ? this : balanceRange(NodeType.none, this.children, this.positions, 0, this.children.length, 0, this.length, (children, positions, length) => new Tree(this.type, children, positions, length, this.propValues), config.makeTree || ((children, positions, length) => new Tree(NodeType.none, children, positions, length)));
	}
	/**
	Build a tree from a postfix-ordered buffer of node information,
	or a cursor over such a buffer.
	*/
	static build(data) {
		return buildTree(data);
	}
};
/**
The empty tree
*/
Tree.empty = new Tree(NodeType.none, [], [], 0);
var FlatBufferCursor = class FlatBufferCursor {
	constructor(buffer, index) {
		this.buffer = buffer;
		this.index = index;
	}
	get id() {
		return this.buffer[this.index - 4];
	}
	get start() {
		return this.buffer[this.index - 3];
	}
	get end() {
		return this.buffer[this.index - 2];
	}
	get size() {
		return this.buffer[this.index - 1];
	}
	get pos() {
		return this.index;
	}
	next() {
		this.index -= 4;
	}
	fork() {
		return new FlatBufferCursor(this.buffer, this.index);
	}
};
/**
Tree buffers contain (type, start, end, endIndex) quads for each
node. In such a buffer, nodes are stored in prefix order (parents
before children, with the endIndex of the parent indicating which
children belong to it).
*/
var TreeBuffer = class TreeBuffer {
	/**
	Create a tree buffer.
	*/
	constructor(buffer, length, set) {
		this.buffer = buffer;
		this.length = length;
		this.set = set;
	}
	/**
	@internal
	*/
	get type() {
		return NodeType.none;
	}
	/**
	@internal
	*/
	toString() {
		let result = [];
		for (let index = 0; index < this.buffer.length;) {
			result.push(this.childString(index));
			index = this.buffer[index + 3];
		}
		return result.join(",");
	}
	/**
	@internal
	*/
	childString(index) {
		let id = this.buffer[index], endIndex = this.buffer[index + 3];
		let type = this.set.types[id], result = type.name;
		if (/\W/.test(result) && !type.isError) result = JSON.stringify(result);
		index += 4;
		if (endIndex == index) return result;
		let children = [];
		while (index < endIndex) {
			children.push(this.childString(index));
			index = this.buffer[index + 3];
		}
		return result + "(" + children.join(",") + ")";
	}
	/**
	@internal
	*/
	findChild(startIndex, endIndex, dir, pos, side) {
		let { buffer } = this, pick = -1;
		for (let i = startIndex; i != endIndex; i = buffer[i + 3]) if (checkSide(side, pos, buffer[i + 1], buffer[i + 2])) {
			pick = i;
			if (dir > 0) break;
		}
		return pick;
	}
	/**
	@internal
	*/
	slice(startI, endI, from) {
		let b = this.buffer;
		let copy = new Uint16Array(endI - startI), len = 0;
		for (let i = startI, j = 0; i < endI;) {
			copy[j++] = b[i++];
			copy[j++] = b[i++] - from;
			let to = copy[j++] = b[i++] - from;
			copy[j++] = b[i++] - startI;
			len = Math.max(len, to);
		}
		return new TreeBuffer(copy, len, this.set);
	}
};
function checkSide(side, pos, from, to) {
	switch (side) {
		case -2: return from < pos;
		case -1: return to >= pos && from < pos;
		case 0: return from < pos && to > pos;
		case 1: return from <= pos && to > pos;
		case 2: return to > pos;
		case 4: return true;
	}
}
function resolveNode(node, pos, side, overlays) {
	var _a;
	while (node.from == node.to || (side < 1 ? node.from >= pos : node.from > pos) || (side > -1 ? node.to <= pos : node.to < pos)) {
		let parent = !overlays && node instanceof TreeNode && node.index < 0 ? null : node.parent;
		if (!parent) return node;
		node = parent;
	}
	let mode = overlays ? 0 : IterMode.IgnoreOverlays;
	if (overlays) {
		for (let scan = node, parent = scan.parent; parent; scan = parent, parent = scan.parent) if (scan instanceof TreeNode && scan.index < 0 && ((_a = parent.enter(pos, side, mode)) === null || _a === void 0 ? void 0 : _a.from) != scan.from) node = parent;
	}
	for (;;) {
		let inner = node.enter(pos, side, mode);
		if (!inner) return node;
		node = inner;
	}
}
var BaseNode = class {
	cursor(mode = 0) {
		return new TreeCursor(this, mode);
	}
	getChild(type, before = null, after = null) {
		let r = getChildren(this, type, before, after);
		return r.length ? r[0] : null;
	}
	getChildren(type, before = null, after = null) {
		return getChildren(this, type, before, after);
	}
	resolve(pos, side = 0) {
		return resolveNode(this, pos, side, false);
	}
	resolveInner(pos, side = 0) {
		return resolveNode(this, pos, side, true);
	}
	matchContext(context) {
		return matchNodeContext(this.parent, context);
	}
	enterUnfinishedNodesBefore(pos) {
		let scan = this.childBefore(pos), node = this;
		while (scan) {
			let last = scan.lastChild;
			if (!last || last.to != scan.to) break;
			if (last.type.isError && last.from == last.to) {
				node = scan;
				scan = last.prevSibling;
			} else scan = last;
		}
		return node;
	}
	get node() {
		return this;
	}
	get next() {
		return this.parent;
	}
};
var TreeNode = class TreeNode extends BaseNode {
	constructor(_tree, from, index, _parent) {
		super();
		this._tree = _tree;
		this.from = from;
		this.index = index;
		this._parent = _parent;
	}
	get type() {
		return this._tree.type;
	}
	get name() {
		return this._tree.type.name;
	}
	get to() {
		return this.from + this._tree.length;
	}
	nextChild(i, dir, pos, side, mode = 0) {
		for (let parent = this;;) {
			for (let { children, positions } = parent._tree, e = dir > 0 ? children.length : -1; i != e; i += dir) {
				let next = children[i], start = positions[i] + parent.from, mounted;
				if (!(mode & IterMode.EnterBracketed && next instanceof Tree && (mounted = MountedTree.get(next)) && !mounted.overlay && mounted.bracketed && pos >= start && pos <= start + next.length) && !checkSide(side, pos, start, start + next.length)) continue;
				if (next instanceof TreeBuffer) {
					if (mode & IterMode.ExcludeBuffers) continue;
					let index = next.findChild(0, next.buffer.length, dir, pos - start, side);
					if (index > -1) return new BufferNode(new BufferContext(parent, next, i, start), null, index);
				} else if (mode & IterMode.IncludeAnonymous || !next.type.isAnonymous || hasChild(next)) {
					let mounted;
					if (!(mode & IterMode.IgnoreMounts) && (mounted = MountedTree.get(next)) && !mounted.overlay) return new TreeNode(mounted.tree, start, i, parent);
					let inner = new TreeNode(next, start, i, parent);
					return mode & IterMode.IncludeAnonymous || !inner.type.isAnonymous ? inner : inner.nextChild(dir < 0 ? next.children.length - 1 : 0, dir, pos, side, mode);
				}
			}
			if (mode & IterMode.IncludeAnonymous || !parent.type.isAnonymous) return null;
			if (parent.index >= 0) i = parent.index + dir;
			else i = dir < 0 ? -1 : parent._parent._tree.children.length;
			parent = parent._parent;
			if (!parent) return null;
		}
	}
	get firstChild() {
		return this.nextChild(0, 1, 0, 4);
	}
	get lastChild() {
		return this.nextChild(this._tree.children.length - 1, -1, 0, 4);
	}
	childAfter(pos) {
		return this.nextChild(0, 1, pos, 2);
	}
	childBefore(pos) {
		return this.nextChild(this._tree.children.length - 1, -1, pos, -2);
	}
	prop(prop) {
		return this._tree.prop(prop);
	}
	enter(pos, side, mode = 0) {
		let mounted;
		if (!(mode & IterMode.IgnoreOverlays) && (mounted = MountedTree.get(this._tree)) && mounted.overlay) {
			let rPos = pos - this.from, enterBracketed = mode & IterMode.EnterBracketed && mounted.bracketed;
			for (let { from, to } of mounted.overlay) if ((side > 0 || enterBracketed ? from <= rPos : from < rPos) && (side < 0 || enterBracketed ? to >= rPos : to > rPos)) return new TreeNode(mounted.tree, mounted.overlay[0].from + this.from, -1, this);
		}
		return this.nextChild(0, 1, pos, side, mode);
	}
	nextSignificantParent() {
		let val = this;
		while (val.type.isAnonymous && val._parent) val = val._parent;
		return val;
	}
	get parent() {
		return this._parent ? this._parent.nextSignificantParent() : null;
	}
	get nextSibling() {
		return this._parent && this.index >= 0 ? this._parent.nextChild(this.index + 1, 1, 0, 4) : null;
	}
	get prevSibling() {
		return this._parent && this.index >= 0 ? this._parent.nextChild(this.index - 1, -1, 0, 4) : null;
	}
	get tree() {
		return this._tree;
	}
	toTree() {
		return this._tree;
	}
	/**
	@internal
	*/
	toString() {
		return this._tree.toString();
	}
};
function getChildren(node, type, before, after) {
	let cur = node.cursor(), result = [];
	if (!cur.firstChild()) return result;
	if (before != null) for (let found = false; !found;) {
		found = cur.type.is(before);
		if (!cur.nextSibling()) return result;
	}
	for (;;) {
		if (after != null && cur.type.is(after)) return result;
		if (cur.type.is(type)) result.push(cur.node);
		if (!cur.nextSibling()) return after == null ? result : [];
	}
}
function matchNodeContext(node, context, i = context.length - 1) {
	for (let p = node; i >= 0; p = p.parent) {
		if (!p) return false;
		if (!p.type.isAnonymous) {
			if (context[i] && context[i] != p.name) return false;
			i--;
		}
	}
	return true;
}
var BufferContext = class {
	constructor(parent, buffer, index, start) {
		this.parent = parent;
		this.buffer = buffer;
		this.index = index;
		this.start = start;
	}
};
var BufferNode = class BufferNode extends BaseNode {
	get name() {
		return this.type.name;
	}
	get from() {
		return this.context.start + this.context.buffer.buffer[this.index + 1];
	}
	get to() {
		return this.context.start + this.context.buffer.buffer[this.index + 2];
	}
	constructor(context, _parent, index) {
		super();
		this.context = context;
		this._parent = _parent;
		this.index = index;
		this.type = context.buffer.set.types[context.buffer.buffer[index]];
	}
	child(dir, pos, side) {
		let { buffer } = this.context;
		let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, pos - this.context.start, side);
		return index < 0 ? null : new BufferNode(this.context, this, index);
	}
	get firstChild() {
		return this.child(1, 0, 4);
	}
	get lastChild() {
		return this.child(-1, 0, 4);
	}
	childAfter(pos) {
		return this.child(1, pos, 2);
	}
	childBefore(pos) {
		return this.child(-1, pos, -2);
	}
	prop(prop) {
		return this.type.prop(prop);
	}
	enter(pos, side, mode = 0) {
		if (mode & IterMode.ExcludeBuffers) return null;
		let { buffer } = this.context;
		let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], side > 0 ? 1 : -1, pos - this.context.start, side);
		return index < 0 ? null : new BufferNode(this.context, this, index);
	}
	get parent() {
		return this._parent || this.context.parent.nextSignificantParent();
	}
	externalSibling(dir) {
		return this._parent ? null : this.context.parent.nextChild(this.context.index + dir, dir, 0, 4);
	}
	get nextSibling() {
		let { buffer } = this.context;
		let after = buffer.buffer[this.index + 3];
		if (after < (this._parent ? buffer.buffer[this._parent.index + 3] : buffer.buffer.length)) return new BufferNode(this.context, this._parent, after);
		return this.externalSibling(1);
	}
	get prevSibling() {
		let { buffer } = this.context;
		let parentStart = this._parent ? this._parent.index + 4 : 0;
		if (this.index == parentStart) return this.externalSibling(-1);
		return new BufferNode(this.context, this._parent, buffer.findChild(parentStart, this.index, -1, 0, 4));
	}
	get tree() {
		return null;
	}
	toTree() {
		let children = [], positions = [];
		let { buffer } = this.context;
		let startI = this.index + 4, endI = buffer.buffer[this.index + 3];
		if (endI > startI) {
			let from = buffer.buffer[this.index + 1];
			children.push(buffer.slice(startI, endI, from));
			positions.push(0);
		}
		return new Tree(this.type, children, positions, this.to - this.from);
	}
	/**
	@internal
	*/
	toString() {
		return this.context.buffer.childString(this.index);
	}
};
function iterStack(heads) {
	if (!heads.length) return null;
	let pick = 0, picked = heads[0];
	for (let i = 1; i < heads.length; i++) {
		let node = heads[i];
		if (node.from > picked.from || node.to < picked.to) {
			picked = node;
			pick = i;
		}
	}
	let next = picked instanceof TreeNode && picked.index < 0 ? null : picked.parent;
	let newHeads = heads.slice();
	if (next) newHeads[pick] = next;
	else newHeads.splice(pick, 1);
	return new StackIterator(newHeads, picked);
}
var StackIterator = class {
	constructor(heads, node) {
		this.heads = heads;
		this.node = node;
	}
	get next() {
		return iterStack(this.heads);
	}
};
function stackIterator(tree, pos, side) {
	let inner = tree.resolveInner(pos, side), layers = null;
	for (let scan = inner instanceof TreeNode ? inner : inner.context.parent; scan; scan = scan.parent) if (scan.index < 0) {
		let parent = scan.parent;
		(layers || (layers = [inner])).push(parent.resolve(pos, side));
		scan = parent;
	} else {
		let mount = MountedTree.get(scan.tree);
		if (mount && mount.overlay && mount.overlay[0].from <= pos && mount.overlay[mount.overlay.length - 1].to >= pos) {
			let root = new TreeNode(mount.tree, mount.overlay[0].from + scan.from, -1, scan);
			(layers || (layers = [inner])).push(resolveNode(root, pos, side, false));
		}
	}
	return layers ? iterStack(layers) : inner;
}
/**
A tree cursor object focuses on a given node in a syntax tree, and
allows you to move to adjacent nodes.
*/
var TreeCursor = class {
	/**
	Shorthand for `.type.name`.
	*/
	get name() {
		return this.type.name;
	}
	/**
	@internal
	*/
	constructor(node, mode = 0) {
		/**
		@internal
		*/
		this.buffer = null;
		this.stack = [];
		/**
		@internal
		*/
		this.index = 0;
		this.bufferNode = null;
		this.mode = mode & ~IterMode.EnterBracketed;
		if (node instanceof TreeNode) this.yieldNode(node);
		else {
			this._tree = node.context.parent;
			this.buffer = node.context;
			for (let n = node._parent; n; n = n._parent) this.stack.unshift(n.index);
			this.bufferNode = node;
			this.yieldBuf(node.index);
		}
	}
	yieldNode(node) {
		if (!node) return false;
		this._tree = node;
		this.type = node.type;
		this.from = node.from;
		this.to = node.to;
		return true;
	}
	yieldBuf(index, type) {
		this.index = index;
		let { start, buffer } = this.buffer;
		this.type = type || buffer.set.types[buffer.buffer[index]];
		this.from = start + buffer.buffer[index + 1];
		this.to = start + buffer.buffer[index + 2];
		return true;
	}
	/**
	@internal
	*/
	yield(node) {
		if (!node) return false;
		if (node instanceof TreeNode) {
			this.buffer = null;
			return this.yieldNode(node);
		}
		this.buffer = node.context;
		return this.yieldBuf(node.index, node.type);
	}
	/**
	@internal
	*/
	toString() {
		return this.buffer ? this.buffer.buffer.childString(this.index) : this._tree.toString();
	}
	/**
	@internal
	*/
	enterChild(dir, pos, side) {
		if (!this.buffer) return this.yield(this._tree.nextChild(dir < 0 ? this._tree._tree.children.length - 1 : 0, dir, pos, side, this.mode));
		let { buffer } = this.buffer;
		let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, pos - this.buffer.start, side);
		if (index < 0) return false;
		this.stack.push(this.index);
		return this.yieldBuf(index);
	}
	/**
	Move the cursor to this node's first child. When this returns
	false, the node has no child, and the cursor has not been moved.
	*/
	firstChild() {
		return this.enterChild(1, 0, 4);
	}
	/**
	Move the cursor to this node's last child.
	*/
	lastChild() {
		return this.enterChild(-1, 0, 4);
	}
	/**
	Move the cursor to the first child that ends after `pos`.
	*/
	childAfter(pos) {
		return this.enterChild(1, pos, 2);
	}
	/**
	Move to the last child that starts before `pos`.
	*/
	childBefore(pos) {
		return this.enterChild(-1, pos, -2);
	}
	/**
	Move the cursor to the child around `pos`. If side is -1 the
	child may end at that position, when 1 it may start there. This
	will also enter [overlaid](#common.MountedTree.overlay)
	[mounted](#common.NodeProp^mounted) trees unless `overlays` is
	set to false.
	*/
	enter(pos, side, mode = this.mode) {
		if (!this.buffer) return this.yield(this._tree.enter(pos, side, mode));
		return mode & IterMode.ExcludeBuffers ? false : this.enterChild(1, pos, side);
	}
	/**
	Move to the node's parent node, if this isn't the top node.
	*/
	parent() {
		if (!this.buffer) return this.yieldNode(this.mode & IterMode.IncludeAnonymous ? this._tree._parent : this._tree.parent);
		if (this.stack.length) return this.yieldBuf(this.stack.pop());
		let parent = this.mode & IterMode.IncludeAnonymous ? this.buffer.parent : this.buffer.parent.nextSignificantParent();
		this.buffer = null;
		return this.yieldNode(parent);
	}
	/**
	@internal
	*/
	sibling(dir) {
		if (!this.buffer) return !this._tree._parent ? false : this.yield(this._tree.index < 0 ? null : this._tree._parent.nextChild(this._tree.index + dir, dir, 0, 4, this.mode));
		let { buffer } = this.buffer, d = this.stack.length - 1;
		if (dir < 0) {
			let parentStart = d < 0 ? 0 : this.stack[d] + 4;
			if (this.index != parentStart) return this.yieldBuf(buffer.findChild(parentStart, this.index, -1, 0, 4));
		} else {
			let after = buffer.buffer[this.index + 3];
			if (after < (d < 0 ? buffer.buffer.length : buffer.buffer[this.stack[d] + 3])) return this.yieldBuf(after);
		}
		return d < 0 ? this.yield(this.buffer.parent.nextChild(this.buffer.index + dir, dir, 0, 4, this.mode)) : false;
	}
	/**
	Move to this node's next sibling, if any.
	*/
	nextSibling() {
		return this.sibling(1);
	}
	/**
	Move to this node's previous sibling, if any.
	*/
	prevSibling() {
		return this.sibling(-1);
	}
	atLastNode(dir) {
		let index, parent, { buffer } = this;
		if (buffer) {
			if (dir > 0) {
				if (this.index < buffer.buffer.buffer.length) return false;
			} else for (let i = 0; i < this.index; i++) if (buffer.buffer.buffer[i + 3] < this.index) return false;
			({index, parent} = buffer);
		} else ({index, _parent: parent} = this._tree);
		for (; parent; {index, _parent: parent} = parent) if (index > -1) for (let i = index + dir, e = dir < 0 ? -1 : parent._tree.children.length; i != e; i += dir) {
			let child = parent._tree.children[i];
			if (this.mode & IterMode.IncludeAnonymous || child instanceof TreeBuffer || !child.type.isAnonymous || hasChild(child)) return false;
		}
		return true;
	}
	move(dir, enter) {
		if (enter && this.enterChild(dir, 0, 4)) return true;
		for (;;) {
			if (this.sibling(dir)) return true;
			if (this.atLastNode(dir) || !this.parent()) return false;
		}
	}
	/**
	Move to the next node in a
	[pre-order](https://en.wikipedia.org/wiki/Tree_traversal#Pre-order,_NLR)
	traversal, going from a node to its first child or, if the
	current node is empty or `enter` is false, its next sibling or
	the next sibling of the first parent node that has one.
	*/
	next(enter = true) {
		return this.move(1, enter);
	}
	/**
	Move to the next node in a last-to-first pre-order traversal. A
	node is followed by its last child or, if it has none, its
	previous sibling or the previous sibling of the first parent
	node that has one.
	*/
	prev(enter = true) {
		return this.move(-1, enter);
	}
	/**
	Move the cursor to the innermost node that covers `pos`. If
	`side` is -1, it will enter nodes that end at `pos`. If it is 1,
	it will enter nodes that start at `pos`.
	*/
	moveTo(pos, side = 0) {
		while (this.from == this.to || (side < 1 ? this.from >= pos : this.from > pos) || (side > -1 ? this.to <= pos : this.to < pos)) if (!this.parent()) break;
		while (this.enterChild(1, pos, side));
		return this;
	}
	/**
	Get a [syntax node](#common.SyntaxNode) at the cursor's current
	position.
	*/
	get node() {
		if (!this.buffer) return this._tree;
		let cache = this.bufferNode, result = null, depth = 0;
		if (cache && cache.context == this.buffer) scan: for (let index = this.index, d = this.stack.length; d >= 0;) {
			for (let c = cache; c; c = c._parent) if (c.index == index) {
				if (index == this.index) return c;
				result = c;
				depth = d + 1;
				break scan;
			}
			index = this.stack[--d];
		}
		for (let i = depth; i < this.stack.length; i++) result = new BufferNode(this.buffer, result, this.stack[i]);
		return this.bufferNode = new BufferNode(this.buffer, result, this.index);
	}
	/**
	Get the [tree](#common.Tree) that represents the current node, if
	any. Will return null when the node is in a [tree
	buffer](#common.TreeBuffer).
	*/
	get tree() {
		return this.buffer ? null : this._tree._tree;
	}
	/**
	Iterate over the current node and all its descendants, calling
	`enter` when entering a node and `leave`, if given, when leaving
	one. When `enter` returns `false`, any children of that node are
	skipped, and `leave` isn't called for it.
	*/
	iterate(enter, leave) {
		for (let depth = 0;;) {
			let mustLeave = false;
			if (this.type.isAnonymous || enter(this) !== false) {
				if (this.firstChild()) {
					depth++;
					continue;
				}
				if (!this.type.isAnonymous) mustLeave = true;
			}
			for (;;) {
				if (mustLeave && leave) leave(this);
				mustLeave = this.type.isAnonymous;
				if (!depth) return;
				if (this.nextSibling()) break;
				this.parent();
				depth--;
				mustLeave = true;
			}
		}
	}
	/**
	Test whether the current node matches a given context—a sequence
	of direct parent node names. Empty strings in the context array
	are treated as wildcards.
	*/
	matchContext(context) {
		if (!this.buffer) return matchNodeContext(this.node.parent, context);
		let { buffer } = this.buffer, { types } = buffer.set;
		for (let i = context.length - 1, d = this.stack.length - 1; i >= 0; d--) {
			if (d < 0) return matchNodeContext(this._tree, context, i);
			let type = types[buffer.buffer[this.stack[d]]];
			if (!type.isAnonymous) {
				if (context[i] && context[i] != type.name) return false;
				i--;
			}
		}
		return true;
	}
};
function hasChild(tree) {
	return tree.children.some((ch) => ch instanceof TreeBuffer || !ch.type.isAnonymous || hasChild(ch));
}
function buildTree(data) {
	var _a;
	let { buffer, nodeSet, maxBufferLength = DefaultBufferLength, reused = [], minRepeatType = nodeSet.types.length } = data;
	let cursor = Array.isArray(buffer) ? new FlatBufferCursor(buffer, buffer.length) : buffer;
	let types = nodeSet.types;
	let contextHash = 0, lookAhead = 0;
	function takeNode(parentStart, minPos, children, positions, inRepeat, depth) {
		let { id, start, end, size } = cursor;
		let lookAheadAtStart = lookAhead, contextAtStart = contextHash;
		if (size < 0) {
			cursor.next();
			if (size == -1) {
				let node = reused[id];
				children.push(node);
				positions.push(start - parentStart);
				return;
			} else if (size == -3) {
				contextHash = id;
				return;
			} else if (size == -4) {
				lookAhead = id;
				return;
			} else throw new RangeError(`Unrecognized record size: ${size}`);
		}
		let type = types[id], node, buffer;
		let startPos = start - parentStart;
		if (end - start <= maxBufferLength && (buffer = findBufferSize(cursor.pos - minPos, inRepeat))) {
			let data = new Uint16Array(buffer.size - buffer.skip);
			let endPos = cursor.pos - buffer.size, index = data.length;
			while (cursor.pos > endPos) index = copyToBuffer(buffer.start, data, index);
			node = new TreeBuffer(data, end - buffer.start, nodeSet);
			startPos = buffer.start - parentStart;
		} else {
			let endPos = cursor.pos - size;
			cursor.next();
			let localChildren = [], localPositions = [];
			let localInRepeat = id >= minRepeatType ? id : -1;
			let lastGroup = 0, lastEnd = end;
			while (cursor.pos > endPos) if (localInRepeat >= 0 && cursor.id == localInRepeat && cursor.size >= 0) {
				if (cursor.end <= lastEnd - maxBufferLength) {
					makeRepeatLeaf(localChildren, localPositions, start, lastGroup, cursor.end, lastEnd, localInRepeat, lookAheadAtStart, contextAtStart);
					lastGroup = localChildren.length;
					lastEnd = cursor.end;
				}
				cursor.next();
			} else if (depth > 2500) takeFlatNode(start, endPos, localChildren, localPositions);
			else takeNode(start, endPos, localChildren, localPositions, localInRepeat, depth + 1);
			if (localInRepeat >= 0 && lastGroup > 0 && lastGroup < localChildren.length) makeRepeatLeaf(localChildren, localPositions, start, lastGroup, start, lastEnd, localInRepeat, lookAheadAtStart, contextAtStart);
			localChildren.reverse();
			localPositions.reverse();
			if (localInRepeat > -1 && lastGroup > 0) {
				let make = makeBalanced(type, contextAtStart);
				node = balanceRange(type, localChildren, localPositions, 0, localChildren.length, 0, end - start, make, make);
			} else node = makeTree(type, localChildren, localPositions, end - start, lookAheadAtStart - end, contextAtStart);
		}
		children.push(node);
		positions.push(startPos);
	}
	function takeFlatNode(parentStart, minPos, children, positions) {
		let nodes = [];
		let nodeCount = 0, stopAt = -1;
		while (cursor.pos > minPos) {
			let { id, start, end, size } = cursor;
			if (size > 4) cursor.next();
			else if (stopAt > -1 && start < stopAt) break;
			else {
				if (stopAt < 0) stopAt = end - maxBufferLength;
				nodes.push(id, start, end);
				nodeCount++;
				cursor.next();
			}
		}
		if (nodeCount) {
			let buffer = new Uint16Array(nodeCount * 4);
			let start = nodes[nodes.length - 2];
			for (let i = nodes.length - 3, j = 0; i >= 0; i -= 3) {
				buffer[j++] = nodes[i];
				buffer[j++] = nodes[i + 1] - start;
				buffer[j++] = nodes[i + 2] - start;
				buffer[j++] = j;
			}
			children.push(new TreeBuffer(buffer, nodes[2] - start, nodeSet));
			positions.push(start - parentStart);
		}
	}
	function makeBalanced(type, contextHash) {
		return (children, positions, length) => {
			let lookAhead = 0, lastI = children.length - 1, last, lookAheadProp;
			if (lastI >= 0 && (last = children[lastI]) instanceof Tree) {
				if (!lastI && last.type == type && last.length == length) return last;
				if (lookAheadProp = last.prop(NodeProp.lookAhead)) lookAhead = positions[lastI] + last.length + lookAheadProp;
			}
			return makeTree(type, children, positions, length, lookAhead, contextHash);
		};
	}
	function makeRepeatLeaf(children, positions, base, i, from, to, type, lookAhead, contextHash) {
		let localChildren = [], localPositions = [];
		while (children.length > i) {
			localChildren.push(children.pop());
			localPositions.push(positions.pop() + base - from);
		}
		children.push(makeTree(nodeSet.types[type], localChildren, localPositions, to - from, lookAhead - to, contextHash));
		positions.push(from - base);
	}
	function makeTree(type, children, positions, length, lookAhead, contextHash, props) {
		if (contextHash) {
			let pair = [NodeProp.contextHash, contextHash];
			props = props ? [pair].concat(props) : [pair];
		}
		if (lookAhead > 25) {
			let pair = [NodeProp.lookAhead, lookAhead];
			props = props ? [pair].concat(props) : [pair];
		}
		return new Tree(type, children, positions, length, props);
	}
	function findBufferSize(maxSize, inRepeat) {
		let fork = cursor.fork();
		let size = 0, start = 0, skip = 0, minStart = fork.end - maxBufferLength;
		let result = {
			size: 0,
			start: 0,
			skip: 0
		};
		scan: for (let minPos = fork.pos - maxSize; fork.pos > minPos;) {
			let nodeSize = fork.size;
			if (fork.id == inRepeat && nodeSize >= 0) {
				result.size = size;
				result.start = start;
				result.skip = skip;
				skip += 4;
				size += 4;
				fork.next();
				continue;
			}
			let startPos = fork.pos - nodeSize;
			if (nodeSize < 0 || startPos < minPos || fork.start < minStart) break;
			let localSkipped = fork.id >= minRepeatType ? 4 : 0;
			let nodeStart = fork.start;
			fork.next();
			while (fork.pos > startPos) {
				if (fork.size < 0) if (fork.size == -3 || fork.size == -4) localSkipped += 4;
				else break scan;
				else if (fork.id >= minRepeatType) localSkipped += 4;
				fork.next();
			}
			start = nodeStart;
			size += nodeSize;
			skip += localSkipped;
		}
		if (inRepeat < 0 || size == maxSize) {
			result.size = size;
			result.start = start;
			result.skip = skip;
		}
		return result.size > 4 ? result : void 0;
	}
	function copyToBuffer(bufferStart, buffer, index) {
		let { id, start, end, size } = cursor;
		cursor.next();
		if (size >= 0 && id < minRepeatType) {
			let startIndex = index;
			if (size > 4) {
				let endPos = cursor.pos - (size - 4);
				while (cursor.pos > endPos) index = copyToBuffer(bufferStart, buffer, index);
			}
			buffer[--index] = startIndex;
			buffer[--index] = end - bufferStart;
			buffer[--index] = start - bufferStart;
			buffer[--index] = id;
		} else if (size == -3) contextHash = id;
		else if (size == -4) lookAhead = id;
		return index;
	}
	let children = [], positions = [];
	while (cursor.pos > 0) takeNode(data.start || 0, data.bufferStart || 0, children, positions, -1, 0);
	let length = (_a = data.length) !== null && _a !== void 0 ? _a : children.length ? positions[0] + children[0].length : 0;
	return new Tree(types[data.topID], children.reverse(), positions.reverse(), length);
}
var nodeSizeCache = /* @__PURE__ */ new WeakMap();
function nodeSize(balanceType, node) {
	if (!balanceType.isAnonymous || node instanceof TreeBuffer || node.type != balanceType) return 1;
	let size = nodeSizeCache.get(node);
	if (size == null) {
		size = 1;
		for (let child of node.children) {
			if (child.type != balanceType || !(child instanceof Tree)) {
				size = 1;
				break;
			}
			size += nodeSize(balanceType, child);
		}
		nodeSizeCache.set(node, size);
	}
	return size;
}
function balanceRange(balanceType, children, positions, from, to, start, length, mkTop, mkTree) {
	let total = 0;
	for (let i = from; i < to; i++) total += nodeSize(balanceType, children[i]);
	let maxChild = Math.ceil(total * 1.5 / 8);
	let localChildren = [], localPositions = [];
	function divide(children, positions, from, to, offset) {
		for (let i = from; i < to;) {
			let groupFrom = i, groupStart = positions[i], groupSize = nodeSize(balanceType, children[i]);
			i++;
			for (; i < to; i++) {
				let nextSize = nodeSize(balanceType, children[i]);
				if (groupSize + nextSize >= maxChild) break;
				groupSize += nextSize;
			}
			if (i == groupFrom + 1) {
				if (groupSize > maxChild) {
					let only = children[groupFrom];
					divide(only.children, only.positions, 0, only.children.length, positions[groupFrom] + offset);
					continue;
				}
				localChildren.push(children[groupFrom]);
			} else {
				let length = positions[i - 1] + children[i - 1].length - groupStart;
				localChildren.push(balanceRange(balanceType, children, positions, groupFrom, i, groupStart, length, null, mkTree));
			}
			localPositions.push(groupStart + offset - start);
		}
	}
	divide(children, positions, from, to, 0);
	return (mkTop || mkTree)(localChildren, localPositions, length);
}
/**
Provides a way to associate values with pieces of trees. As long
as that part of the tree is reused, the associated values can be
retrieved from an updated tree.
*/
var NodeWeakMap = class {
	constructor() {
		this.map = /* @__PURE__ */ new WeakMap();
	}
	setBuffer(buffer, index, value) {
		let inner = this.map.get(buffer);
		if (!inner) this.map.set(buffer, inner = /* @__PURE__ */ new Map());
		inner.set(index, value);
	}
	getBuffer(buffer, index) {
		let inner = this.map.get(buffer);
		return inner && inner.get(index);
	}
	/**
	Set the value for this syntax node.
	*/
	set(node, value) {
		if (node instanceof BufferNode) this.setBuffer(node.context.buffer, node.index, value);
		else if (node instanceof TreeNode) this.map.set(node.tree, value);
	}
	/**
	Retrieve value for this syntax node, if it exists in the map.
	*/
	get(node) {
		return node instanceof BufferNode ? this.getBuffer(node.context.buffer, node.index) : node instanceof TreeNode ? this.map.get(node.tree) : void 0;
	}
	/**
	Set the value for the node that a cursor currently points to.
	*/
	cursorSet(cursor, value) {
		if (cursor.buffer) this.setBuffer(cursor.buffer.buffer, cursor.index, value);
		else this.map.set(cursor.tree, value);
	}
	/**
	Retrieve the value for the node that a cursor currently points
	to.
	*/
	cursorGet(cursor) {
		return cursor.buffer ? this.getBuffer(cursor.buffer.buffer, cursor.index) : this.map.get(cursor.tree);
	}
};
/**
Tree fragments are used during [incremental
parsing](#common.Parser.startParse) to track parts of old trees
that can be reused in a new parse. An array of fragments is used
to track regions of an old tree whose nodes might be reused in new
parses. Use the static
[`applyChanges`](#common.TreeFragment^applyChanges) method to
update fragments for document changes.
*/
var TreeFragment = class TreeFragment {
	/**
	Construct a tree fragment. You'll usually want to use
	[`addTree`](#common.TreeFragment^addTree) and
	[`applyChanges`](#common.TreeFragment^applyChanges) instead of
	calling this directly.
	*/
	constructor(from, to, tree, offset, openStart = false, openEnd = false) {
		this.from = from;
		this.to = to;
		this.tree = tree;
		this.offset = offset;
		this.open = (openStart ? 1 : 0) | (openEnd ? 2 : 0);
	}
	/**
	Whether the start of the fragment represents the start of a
	parse, or the end of a change. (In the second case, it may not
	be safe to reuse some nodes at the start, depending on the
	parsing algorithm.)
	*/
	get openStart() {
		return (this.open & 1) > 0;
	}
	/**
	Whether the end of the fragment represents the end of a
	full-document parse, or the start of a change.
	*/
	get openEnd() {
		return (this.open & 2) > 0;
	}
	/**
	Create a set of fragments from a freshly parsed tree, or update
	an existing set of fragments by replacing the ones that overlap
	with a tree with content from the new tree. When `partial` is
	true, the parse is treated as incomplete, and the resulting
	fragment has [`openEnd`](#common.TreeFragment.openEnd) set to
	true.
	*/
	static addTree(tree, fragments = [], partial = false) {
		let result = [new TreeFragment(0, tree.length, tree, 0, false, partial)];
		for (let f of fragments) if (f.to > tree.length) result.push(f);
		return result;
	}
	/**
	Apply a set of edits to an array of fragments, removing or
	splitting fragments as necessary to remove edited ranges, and
	adjusting offsets for fragments that moved.
	*/
	static applyChanges(fragments, changes, minGap = 128) {
		if (!changes.length) return fragments;
		let result = [];
		let fI = 1, nextF = fragments.length ? fragments[0] : null;
		for (let cI = 0, pos = 0, off = 0;; cI++) {
			let nextC = cI < changes.length ? changes[cI] : null;
			let nextPos = nextC ? nextC.fromA : 1e9;
			if (nextPos - pos >= minGap) while (nextF && nextF.from < nextPos) {
				let cut = nextF;
				if (pos >= cut.from || nextPos <= cut.to || off) {
					let fFrom = Math.max(cut.from, pos) - off, fTo = Math.min(cut.to, nextPos) - off;
					cut = fFrom >= fTo ? null : new TreeFragment(fFrom, fTo, cut.tree, cut.offset + off, cI > 0, !!nextC);
				}
				if (cut) result.push(cut);
				if (nextF.to > nextPos) break;
				nextF = fI < fragments.length ? fragments[fI++] : null;
			}
			if (!nextC) break;
			pos = nextC.toA;
			off = nextC.toA - nextC.toB;
		}
		return result;
	}
};
/**
A superclass that parsers should extend.
*/
var Parser = class {
	/**
	Start a parse, returning a [partial parse](#common.PartialParse)
	object. [`fragments`](#common.TreeFragment) can be passed in to
	make the parse incremental.
	
	By default, the entire input is parsed. You can pass `ranges`,
	which should be a sorted array of non-empty, non-overlapping
	ranges, to parse only those ranges. The tree returned in that
	case will start at `ranges[0].from`.
	*/
	startParse(input, fragments, ranges) {
		if (typeof input == "string") input = new StringInput(input);
		ranges = !ranges ? [new Range(0, input.length)] : ranges.length ? ranges.map((r) => new Range(r.from, r.to)) : [new Range(0, 0)];
		return this.createParse(input, fragments || [], ranges);
	}
	/**
	Run a full parse, returning the resulting tree.
	*/
	parse(input, fragments, ranges) {
		let parse = this.startParse(input, fragments, ranges);
		for (;;) {
			let done = parse.advance();
			if (done) return done;
		}
	}
};
var StringInput = class {
	constructor(string) {
		this.string = string;
	}
	get length() {
		return this.string.length;
	}
	chunk(from) {
		return this.string.slice(from);
	}
	get lineChunks() {
		return false;
	}
	read(from, to) {
		return this.string.slice(from, to);
	}
};
/**
Create a parse wrapper that, after the inner parse completes,
scans its tree for mixed language regions with the `nest`
function, runs the resulting [inner parses](#common.NestedParse),
and then [mounts](#common.NodeProp^mounted) their results onto the
tree.
*/
function parseMixed(nest) {
	return (parse, input, fragments, ranges) => new MixedParse(parse, nest, input, fragments, ranges);
}
var InnerParse = class {
	constructor(parser, parse, overlay, bracketed, target, from) {
		this.parser = parser;
		this.parse = parse;
		this.overlay = overlay;
		this.bracketed = bracketed;
		this.target = target;
		this.from = from;
	}
};
function checkRanges(ranges) {
	if (!ranges.length || ranges.some((r) => r.from >= r.to)) throw new RangeError("Invalid inner parse ranges given: " + JSON.stringify(ranges));
}
var ActiveOverlay = class {
	constructor(parser, predicate, mounts, index, start, bracketed, target, prev) {
		this.parser = parser;
		this.predicate = predicate;
		this.mounts = mounts;
		this.index = index;
		this.start = start;
		this.bracketed = bracketed;
		this.target = target;
		this.prev = prev;
		this.depth = 0;
		this.ranges = [];
	}
};
var stoppedInner = new NodeProp({ perNode: true });
var MixedParse = class {
	constructor(base, nest, input, fragments, ranges) {
		this.nest = nest;
		this.input = input;
		this.fragments = fragments;
		this.ranges = ranges;
		this.inner = [];
		this.innerDone = 0;
		this.baseTree = null;
		this.stoppedAt = null;
		this.baseParse = base;
	}
	advance() {
		if (this.baseParse) {
			let done = this.baseParse.advance();
			if (!done) return null;
			this.baseParse = null;
			this.baseTree = done;
			this.startInner();
			if (this.stoppedAt != null) for (let inner of this.inner) inner.parse.stopAt(this.stoppedAt);
		}
		if (this.innerDone == this.inner.length) {
			let result = this.baseTree;
			if (this.stoppedAt != null) result = new Tree(result.type, result.children, result.positions, result.length, result.propValues.concat([[stoppedInner, this.stoppedAt]]));
			return result;
		}
		let inner = this.inner[this.innerDone], done = inner.parse.advance();
		if (done) {
			this.innerDone++;
			let props = Object.assign(Object.create(null), inner.target.props);
			props[NodeProp.mounted.id] = new MountedTree(done, inner.overlay, inner.parser, inner.bracketed);
			inner.target.props = props;
		}
		return null;
	}
	get parsedPos() {
		if (this.baseParse) return 0;
		let pos = this.input.length;
		for (let i = this.innerDone; i < this.inner.length; i++) if (this.inner[i].from < pos) pos = Math.min(pos, this.inner[i].parse.parsedPos);
		return pos;
	}
	stopAt(pos) {
		this.stoppedAt = pos;
		if (this.baseParse) this.baseParse.stopAt(pos);
		else for (let i = this.innerDone; i < this.inner.length; i++) this.inner[i].parse.stopAt(pos);
	}
	startInner() {
		let fragmentCursor = new FragmentCursor(this.fragments);
		let overlay = null;
		let covered = null;
		let cursor = new TreeCursor(new TreeNode(this.baseTree, this.ranges[0].from, 0, null), IterMode.IncludeAnonymous | IterMode.IgnoreMounts);
		scan: for (let nest, isCovered;;) {
			let enter = true, range;
			if (this.stoppedAt != null && cursor.from >= this.stoppedAt) enter = false;
			else if (fragmentCursor.hasNode(cursor)) {
				if (overlay) {
					let match = overlay.mounts.find((m) => m.frag.from <= cursor.from && m.frag.to >= cursor.to && m.mount.overlay);
					if (match) for (let r of match.mount.overlay) {
						let from = r.from + match.pos, to = r.to + match.pos;
						if (from >= cursor.from && to <= cursor.to && !overlay.ranges.some((r) => r.from < to && r.to > from)) overlay.ranges.push({
							from,
							to
						});
					}
				}
				enter = false;
			} else if (covered && (isCovered = checkCover(covered.ranges, cursor.from, cursor.to))) enter = isCovered != 2;
			else if (!cursor.type.isAnonymous && (nest = this.nest(cursor, this.input)) && (cursor.from < cursor.to || !nest.overlay)) {
				if (!cursor.tree) {
					materialize(cursor);
					if (overlay) overlay.depth++;
					if (covered) covered.depth++;
				}
				let oldMounts = fragmentCursor.findMounts(cursor.from, nest.parser);
				if (typeof nest.overlay == "function") overlay = new ActiveOverlay(nest.parser, nest.overlay, oldMounts, this.inner.length, cursor.from, !!nest.bracketed, cursor.tree, overlay);
				else {
					let ranges = punchRanges(this.ranges, nest.overlay || (cursor.from < cursor.to ? [new Range(cursor.from, cursor.to)] : []));
					if (ranges.length) checkRanges(ranges);
					if (ranges.length || !nest.overlay) this.inner.push(new InnerParse(nest.parser, ranges.length ? nest.parser.startParse(this.input, enterFragments(oldMounts, ranges), ranges) : nest.parser.startParse(""), nest.overlay ? nest.overlay.map((r) => new Range(r.from - cursor.from, r.to - cursor.from)) : null, !!nest.bracketed, cursor.tree, ranges.length ? ranges[0].from : cursor.from));
					if (!nest.overlay) enter = false;
					else if (ranges.length) covered = {
						ranges,
						depth: 0,
						prev: covered
					};
				}
			} else if (overlay && (range = overlay.predicate(cursor))) {
				if (range === true) range = new Range(cursor.from, cursor.to);
				if (range.from < range.to) {
					let last = overlay.ranges.length - 1;
					if (last >= 0 && overlay.ranges[last].to == range.from) overlay.ranges[last] = {
						from: overlay.ranges[last].from,
						to: range.to
					};
					else overlay.ranges.push(range);
				}
			}
			if (enter && cursor.firstChild()) {
				if (overlay) overlay.depth++;
				if (covered) covered.depth++;
			} else for (;;) {
				if (cursor.nextSibling()) break;
				if (!cursor.parent()) break scan;
				if (overlay && !--overlay.depth) {
					let ranges = punchRanges(this.ranges, overlay.ranges);
					if (ranges.length) {
						checkRanges(ranges);
						this.inner.splice(overlay.index, 0, new InnerParse(overlay.parser, overlay.parser.startParse(this.input, enterFragments(overlay.mounts, ranges), ranges), overlay.ranges.map((r) => new Range(r.from - overlay.start, r.to - overlay.start)), overlay.bracketed, overlay.target, ranges[0].from));
					}
					overlay = overlay.prev;
				}
				if (covered && !--covered.depth) covered = covered.prev;
			}
		}
	}
};
function checkCover(covered, from, to) {
	for (let range of covered) {
		if (range.from >= to) break;
		if (range.to > from) return range.from <= from && range.to >= to ? 2 : 1;
	}
	return 0;
}
function sliceBuf(buf, startI, endI, nodes, positions, off) {
	if (startI < endI) {
		let from = buf.buffer[startI + 1];
		nodes.push(buf.slice(startI, endI, from));
		positions.push(from - off);
	}
}
function materialize(cursor) {
	let { node } = cursor, stack = [];
	let buffer = node.context.buffer;
	do {
		stack.push(cursor.index);
		cursor.parent();
	} while (!cursor.tree);
	let base = cursor.tree, i = base.children.indexOf(buffer);
	let buf = base.children[i], b = buf.buffer, newStack = [i];
	function split(startI, endI, type, innerOffset, length, stackPos) {
		let targetI = stack[stackPos];
		let children = [], positions = [];
		sliceBuf(buf, startI, targetI, children, positions, innerOffset);
		let from = b[targetI + 1], to = b[targetI + 2];
		newStack.push(children.length);
		let child = stackPos ? split(targetI + 4, b[targetI + 3], buf.set.types[b[targetI]], from, to - from, stackPos - 1) : node.toTree();
		children.push(child);
		positions.push(from - innerOffset);
		sliceBuf(buf, b[targetI + 3], endI, children, positions, innerOffset);
		return new Tree(type, children, positions, length);
	}
	base.children[i] = split(0, b.length, NodeType.none, 0, buf.length, stack.length - 1);
	for (let index of newStack) {
		let tree = cursor.tree.children[index], pos = cursor.tree.positions[index];
		cursor.yield(new TreeNode(tree, pos + cursor.from, index, cursor._tree));
	}
}
var StructureCursor = class {
	constructor(root, offset) {
		this.offset = offset;
		this.done = false;
		this.cursor = root.cursor(IterMode.IncludeAnonymous | IterMode.IgnoreMounts);
	}
	moveTo(pos) {
		let { cursor } = this, p = pos - this.offset;
		while (!this.done && cursor.from < p) if (cursor.to >= pos && cursor.enter(p, 1, IterMode.IgnoreOverlays | IterMode.ExcludeBuffers));
		else if (cursor.to <= pos) {
			if (!cursor.next(false)) this.done = true;
		} else break;
	}
	hasNode(cursor) {
		this.moveTo(cursor.from);
		if (!this.done && this.cursor.from + this.offset == cursor.from && this.cursor.tree) for (let tree = this.cursor.tree;;) {
			if (tree == cursor.tree) return true;
			if (tree.children.length && tree.positions[0] == 0 && tree.children[0] instanceof Tree) tree = tree.children[0];
			else break;
		}
		return false;
	}
};
var FragmentCursor = class {
	constructor(fragments) {
		var _a;
		this.fragments = fragments;
		this.curTo = 0;
		this.fragI = 0;
		if (fragments.length) {
			let first = this.curFrag = fragments[0];
			this.curTo = (_a = first.tree.prop(stoppedInner)) !== null && _a !== void 0 ? _a : first.to;
			this.inner = new StructureCursor(first.tree, -first.offset);
		} else this.curFrag = this.inner = null;
	}
	hasNode(node) {
		while (this.curFrag && node.from >= this.curTo) this.nextFrag();
		return this.curFrag && this.curFrag.from <= node.from && this.curTo >= node.to && this.inner.hasNode(node);
	}
	nextFrag() {
		var _a;
		this.fragI++;
		if (this.fragI == this.fragments.length) this.curFrag = this.inner = null;
		else {
			let frag = this.curFrag = this.fragments[this.fragI];
			this.curTo = (_a = frag.tree.prop(stoppedInner)) !== null && _a !== void 0 ? _a : frag.to;
			this.inner = new StructureCursor(frag.tree, -frag.offset);
		}
	}
	findMounts(pos, parser) {
		var _a;
		let result = [];
		if (this.inner) {
			this.inner.cursor.moveTo(pos, 1);
			for (let pos = this.inner.cursor.node; pos; pos = pos.parent) {
				let mount = (_a = pos.tree) === null || _a === void 0 ? void 0 : _a.prop(NodeProp.mounted);
				if (mount && mount.parser == parser) for (let i = this.fragI; i < this.fragments.length; i++) {
					let frag = this.fragments[i];
					if (frag.from >= pos.to) break;
					if (frag.tree == this.curFrag.tree) result.push({
						frag,
						pos: pos.from - frag.offset,
						mount
					});
				}
			}
		}
		return result;
	}
};
function punchRanges(outer, ranges) {
	let copy = null, current = ranges;
	for (let i = 1, j = 0; i < outer.length; i++) {
		let gapFrom = outer[i - 1].to, gapTo = outer[i].from;
		for (; j < current.length; j++) {
			let r = current[j];
			if (r.from >= gapTo) break;
			if (r.to <= gapFrom) continue;
			if (!copy) current = copy = ranges.slice();
			if (r.from < gapFrom) {
				copy[j] = new Range(r.from, gapFrom);
				if (r.to > gapTo) copy.splice(j + 1, 0, new Range(gapTo, r.to));
			} else if (r.to > gapTo) copy[j--] = new Range(gapTo, r.to);
			else copy.splice(j--, 1);
		}
	}
	return current;
}
function findCoverChanges(a, b, from, to) {
	let iA = 0, iB = 0, inA = false, inB = false, pos = -1e9;
	let result = [];
	for (;;) {
		let nextA = iA == a.length ? 1e9 : inA ? a[iA].to : a[iA].from;
		let nextB = iB == b.length ? 1e9 : inB ? b[iB].to : b[iB].from;
		if (inA != inB) {
			let start = Math.max(pos, from), end = Math.min(nextA, nextB, to);
			if (start < end) result.push(new Range(start, end));
		}
		pos = Math.min(nextA, nextB);
		if (pos == 1e9) break;
		if (nextA == pos) if (!inA) inA = true;
		else {
			inA = false;
			iA++;
		}
		if (nextB == pos) if (!inB) inB = true;
		else {
			inB = false;
			iB++;
		}
	}
	return result;
}
function enterFragments(mounts, ranges) {
	let result = [];
	for (let { pos, mount, frag } of mounts) {
		let startPos = pos + (mount.overlay ? mount.overlay[0].from : 0), endPos = startPos + mount.tree.length;
		let from = Math.max(frag.from, startPos), to = Math.min(frag.to, endPos);
		if (mount.overlay) {
			let changes = findCoverChanges(ranges, mount.overlay.map((r) => new Range(r.from + pos, r.to + pos)), from, to);
			for (let i = 0, pos = from;; i++) {
				let last = i == changes.length, end = last ? to : changes[i].from;
				if (end > pos) result.push(new TreeFragment(pos, end, mount.tree, -startPos, frag.from >= pos || frag.openStart, frag.to <= end || frag.openEnd));
				if (last) break;
				pos = changes[i].to;
			}
		} else result.push(new TreeFragment(from, to, mount.tree, -startPos, frag.from >= startPos || frag.openStart, frag.to <= endPos || frag.openEnd));
	}
	return result;
}
//#endregion
//#region node_modules/@lezer/highlight/dist/index.js
var nextTagID = 0;
/**
Highlighting tags are markers that denote a highlighting category.
They are [associated](#highlight.styleTags) with parts of a syntax
tree by a language mode, and then mapped to an actual CSS style by
a [highlighter](#highlight.Highlighter).

Because syntax tree node types and highlight styles have to be
able to talk the same language, CodeMirror uses a mostly _closed_
[vocabulary](#highlight.tags) of syntax tags (as opposed to
traditional open string-based systems, which make it hard for
highlighting themes to cover all the tokens produced by the
various languages).

It _is_ possible to [define](#highlight.Tag^define) your own
highlighting tags for system-internal use (where you control both
the language package and the highlighter), but such tags will not
be picked up by regular highlighters (though you can derive them
from standard tags to allow highlighters to fall back to those).
*/
var Tag = class Tag {
	/**
	@internal
	*/
	constructor(name, set, base, modified) {
		this.name = name;
		this.set = set;
		this.base = base;
		this.modified = modified;
		/**
		@internal
		*/
		this.id = nextTagID++;
	}
	toString() {
		let { name } = this;
		for (let mod of this.modified) if (mod.name) name = `${mod.name}(${name})`;
		return name;
	}
	static define(nameOrParent, parent) {
		let name = typeof nameOrParent == "string" ? nameOrParent : "?";
		if (nameOrParent instanceof Tag) parent = nameOrParent;
		if (parent === null || parent === void 0 ? void 0 : parent.base) throw new Error("Can not derive from a modified tag");
		let tag = new Tag(name, [], null, []);
		tag.set.push(tag);
		if (parent) for (let t of parent.set) tag.set.push(t);
		return tag;
	}
	/**
	Define a tag _modifier_, which is a function that, given a tag,
	will return a tag that is a subtag of the original. Applying the
	same modifier to a twice tag will return the same value (`m1(t1)
	== m1(t1)`) and applying multiple modifiers will, regardless or
	order, produce the same tag (`m1(m2(t1)) == m2(m1(t1))`).
	
	When multiple modifiers are applied to a given base tag, each
	smaller set of modifiers is registered as a parent, so that for
	example `m1(m2(m3(t1)))` is a subtype of `m1(m2(t1))`,
	`m1(m3(t1)`, and so on.
	*/
	static defineModifier(name) {
		let mod = new Modifier(name);
		return (tag) => {
			if (tag.modified.indexOf(mod) > -1) return tag;
			return Modifier.get(tag.base || tag, tag.modified.concat(mod).sort((a, b) => a.id - b.id));
		};
	}
};
var nextModifierID = 0;
var Modifier = class Modifier {
	constructor(name) {
		this.name = name;
		this.instances = [];
		this.id = nextModifierID++;
	}
	static get(base, mods) {
		if (!mods.length) return base;
		let exists = mods[0].instances.find((t) => t.base == base && sameArray(mods, t.modified));
		if (exists) return exists;
		let set = [], tag = new Tag(base.name, set, base, mods);
		for (let m of mods) m.instances.push(tag);
		let configs = powerSet(mods);
		for (let parent of base.set) if (!parent.modified.length) for (let config of configs) set.push(Modifier.get(parent, config));
		return tag;
	}
};
function sameArray(a, b) {
	return a.length == b.length && a.every((x, i) => x == b[i]);
}
function powerSet(array) {
	let sets = [[]];
	for (let i = 0; i < array.length; i++) for (let j = 0, e = sets.length; j < e; j++) sets.push(sets[j].concat(array[i]));
	return sets.sort((a, b) => b.length - a.length);
}
/**
This function is used to add a set of tags to a language syntax
via [`NodeSet.extend`](#common.NodeSet.extend) or
[`LRParser.configure`](#lr.LRParser.configure).

The argument object maps node selectors to [highlighting
tags](#highlight.Tag) or arrays of tags.

Node selectors may hold one or more (space-separated) node paths.
Such a path can be a [node name](#common.NodeType.name), or
multiple node names (or `*` wildcards) separated by slash
characters, as in `"Block/Declaration/VariableName"`. Such a path
matches the final node but only if its direct parent nodes are the
other nodes mentioned. A `*` in such a path matches any parent,
but only a single level—wildcards that match multiple parents
aren't supported, both for efficiency reasons and because Lezer
trees make it rather hard to reason about what they would match.)

A path can be ended with `/...` to indicate that the tag assigned
to the node should also apply to all child nodes, even if they
match their own style (by default, only the innermost style is
used).

When a path ends in `!`, as in `Attribute!`, no further matching
happens for the node's child nodes, and the entire node gets the
given style.

In this notation, node names that contain `/`, `!`, `*`, or `...`
must be quoted as JSON strings.

For example:

```javascript
parser.configure({props: [
styleTags({
// Style Number and BigNumber nodes
"Number BigNumber": tags.number,
// Style Escape nodes whose parent is String
"String/Escape": tags.escape,
// Style anything inside Attributes nodes
"Attributes!": tags.meta,
// Add a style to all content inside Italic nodes
"Italic/...": tags.emphasis,
// Style InvalidString nodes as both `string` and `invalid`
"InvalidString": [tags.string, tags.invalid],
// Style the node named "/" as punctuation
'"/"': tags.punctuation
})
]})
```
*/
function styleTags(spec) {
	let byName = Object.create(null);
	for (let prop in spec) {
		let tags = spec[prop];
		if (!Array.isArray(tags)) tags = [tags];
		for (let part of prop.split(" ")) if (part) {
			let pieces = [], mode = 2, rest = part;
			for (let pos = 0;;) {
				if (rest == "..." && pos > 0 && pos + 3 == part.length) {
					mode = 1;
					break;
				}
				let m = /^"(?:[^"\\]|\\.)*?"|[^\/!]+/.exec(rest);
				if (!m) throw new RangeError("Invalid path: " + part);
				pieces.push(m[0] == "*" ? "" : m[0][0] == "\"" ? JSON.parse(m[0]) : m[0]);
				pos += m[0].length;
				if (pos == part.length) break;
				let next = part[pos++];
				if (pos == part.length && next == "!") {
					mode = 0;
					break;
				}
				if (next != "/") throw new RangeError("Invalid path: " + part);
				rest = part.slice(pos);
			}
			let last = pieces.length - 1, inner = pieces[last];
			if (!inner) throw new RangeError("Invalid path: " + part);
			byName[inner] = new Rule(tags, mode, last > 0 ? pieces.slice(0, last) : null).sort(byName[inner]);
		}
	}
	return ruleNodeProp.add(byName);
}
var ruleNodeProp = new NodeProp({ combine(a, b) {
	let cur, root, take;
	while (a || b) {
		if (!a || b && a.depth >= b.depth) {
			take = b;
			b = b.next;
		} else {
			take = a;
			a = a.next;
		}
		if (cur && cur.mode == take.mode && !take.context && !cur.context) continue;
		let copy = new Rule(take.tags, take.mode, take.context);
		if (cur) cur.next = copy;
		else root = copy;
		cur = copy;
	}
	return root;
} });
var Rule = class {
	constructor(tags, mode, context, next) {
		this.tags = tags;
		this.mode = mode;
		this.context = context;
		this.next = next;
	}
	get opaque() {
		return this.mode == 0;
	}
	get inherit() {
		return this.mode == 1;
	}
	sort(other) {
		if (!other || other.depth < this.depth) {
			this.next = other;
			return this;
		}
		other.next = this.sort(other.next);
		return other;
	}
	get depth() {
		return this.context ? this.context.length : 0;
	}
};
Rule.empty = new Rule([], 2, null);
/**
Define a [highlighter](#highlight.Highlighter) from an array of
tag/class pairs. Classes associated with more specific tags will
take precedence.
*/
function tagHighlighter(tags, options) {
	let map = Object.create(null);
	for (let style of tags) if (!Array.isArray(style.tag)) map[style.tag.id] = style.class;
	else for (let tag of style.tag) map[tag.id] = style.class;
	let { scope, all = null } = options || {};
	return {
		style: (tags) => {
			let cls = all;
			for (let tag of tags) for (let sub of tag.set) {
				let tagClass = map[sub.id];
				if (tagClass) {
					cls = cls ? cls + " " + tagClass : tagClass;
					break;
				}
			}
			return cls;
		},
		scope
	};
}
function highlightTags(highlighters, tags) {
	let result = null;
	for (let highlighter of highlighters) {
		let value = highlighter.style(tags);
		if (value) result = result ? result + " " + value : value;
	}
	return result;
}
/**
Highlight the given [tree](#common.Tree) with the given
[highlighter](#highlight.Highlighter). Often, the higher-level
[`highlightCode`](#highlight.highlightCode) function is easier to
use.
*/
function highlightTree(tree, highlighter, putStyle, from = 0, to = tree.length) {
	let builder = new HighlightBuilder(from, Array.isArray(highlighter) ? highlighter : [highlighter], putStyle);
	builder.highlightRange(tree.cursor(), from, to, "", builder.highlighters);
	builder.flush(to);
}
var HighlightBuilder = class {
	constructor(at, highlighters, span) {
		this.at = at;
		this.highlighters = highlighters;
		this.span = span;
		this.class = "";
	}
	startSpan(at, cls) {
		if (cls != this.class) {
			this.flush(at);
			if (at > this.at) this.at = at;
			this.class = cls;
		}
	}
	flush(to) {
		if (to > this.at && this.class) this.span(this.at, to, this.class);
	}
	highlightRange(cursor, from, to, inheritedClass, highlighters) {
		let { type, from: start, to: end } = cursor;
		if (start >= to || end <= from) return;
		if (type.isTop) highlighters = this.highlighters.filter((h) => !h.scope || h.scope(type));
		let cls = inheritedClass;
		let rule = getStyleTags(cursor) || Rule.empty;
		let tagCls = highlightTags(highlighters, rule.tags);
		if (tagCls) {
			if (cls) cls += " ";
			cls += tagCls;
			if (rule.mode == 1) inheritedClass += (inheritedClass ? " " : "") + tagCls;
		}
		this.startSpan(Math.max(from, start), cls);
		if (rule.opaque) return;
		let mounted = cursor.tree && cursor.tree.prop(NodeProp.mounted);
		if (mounted && mounted.overlay) {
			let inner = cursor.node.enter(mounted.overlay[0].from + start, 1);
			let innerHighlighters = this.highlighters.filter((h) => !h.scope || h.scope(mounted.tree.type));
			let hasChild = cursor.firstChild();
			for (let i = 0, pos = start;; i++) {
				let next = i < mounted.overlay.length ? mounted.overlay[i] : null;
				let nextPos = next ? next.from + start : end;
				let rangeFrom = Math.max(from, pos), rangeTo = Math.min(to, nextPos);
				if (rangeFrom < rangeTo && hasChild) while (cursor.from < rangeTo) {
					this.highlightRange(cursor, rangeFrom, rangeTo, inheritedClass, highlighters);
					this.startSpan(Math.min(rangeTo, cursor.to), cls);
					if (cursor.to >= nextPos || !cursor.nextSibling()) break;
				}
				if (!next || nextPos > to) break;
				pos = next.to + start;
				if (pos > from) {
					this.highlightRange(inner.cursor(), Math.max(from, next.from + start), Math.min(to, pos), "", innerHighlighters);
					this.startSpan(Math.min(to, pos), cls);
				}
			}
			if (hasChild) cursor.parent();
		} else if (cursor.firstChild()) {
			if (mounted) inheritedClass = "";
			do {
				if (cursor.to <= from) continue;
				if (cursor.from >= to) break;
				this.highlightRange(cursor, from, to, inheritedClass, highlighters);
				this.startSpan(Math.min(to, cursor.to), cls);
			} while (cursor.nextSibling());
			cursor.parent();
		}
	}
};
/**
Match a syntax node's [highlight rules](#highlight.styleTags). If
there's a match, return its set of tags, and whether it is
opaque (uses a `!`) or applies to all child nodes (`/...`).
*/
function getStyleTags(node) {
	let rule = node.type.prop(ruleNodeProp);
	while (rule && rule.context && !node.matchContext(rule.context)) rule = rule.next;
	return rule || null;
}
var t = Tag.define;
var comment = t(), name = t(), typeName = t(name), propertyName = t(name), literal = t(), string = t(literal), number = t(literal), content = t(), heading = t(content), keyword = t(), operator = t(), punctuation = t(), bracket = t(punctuation), meta = t();
/**
The default set of highlighting [tags](#highlight.Tag).

This collection is heavily biased towards programming languages,
and necessarily incomplete. A full ontology of syntactic
constructs would fill a stack of books, and be impractical to
write themes for. So try to make do with this set. If all else
fails, [open an
issue](https://github.com/codemirror/codemirror.next) to propose a
new tag, or [define](#highlight.Tag^define) a local custom tag for
your use case.

Note that it is not obligatory to always attach the most specific
tag possible to an element—if your grammar can't easily
distinguish a certain type of element (such as a local variable),
it is okay to style it as its more general variant (a variable).

For tags that extend some parent tag, the documentation links to
the parent.
*/
var tags = {
	/**
	A comment.
	*/
	comment,
	/**
	A line [comment](#highlight.tags.comment).
	*/
	lineComment: t(comment),
	/**
	A block [comment](#highlight.tags.comment).
	*/
	blockComment: t(comment),
	/**
	A documentation [comment](#highlight.tags.comment).
	*/
	docComment: t(comment),
	/**
	Any kind of identifier.
	*/
	name,
	/**
	The [name](#highlight.tags.name) of a variable.
	*/
	variableName: t(name),
	/**
	A type [name](#highlight.tags.name).
	*/
	typeName,
	/**
	A tag name (subtag of [`typeName`](#highlight.tags.typeName)).
	*/
	tagName: t(typeName),
	/**
	A property or field [name](#highlight.tags.name).
	*/
	propertyName,
	/**
	An attribute name (subtag of [`propertyName`](#highlight.tags.propertyName)).
	*/
	attributeName: t(propertyName),
	/**
	The [name](#highlight.tags.name) of a class.
	*/
	className: t(name),
	/**
	A label [name](#highlight.tags.name).
	*/
	labelName: t(name),
	/**
	A namespace [name](#highlight.tags.name).
	*/
	namespace: t(name),
	/**
	The [name](#highlight.tags.name) of a macro.
	*/
	macroName: t(name),
	/**
	A literal value.
	*/
	literal,
	/**
	A string [literal](#highlight.tags.literal).
	*/
	string,
	/**
	A documentation [string](#highlight.tags.string).
	*/
	docString: t(string),
	/**
	A character literal (subtag of [string](#highlight.tags.string)).
	*/
	character: t(string),
	/**
	An attribute value (subtag of [string](#highlight.tags.string)).
	*/
	attributeValue: t(string),
	/**
	A number [literal](#highlight.tags.literal).
	*/
	number,
	/**
	An integer [number](#highlight.tags.number) literal.
	*/
	integer: t(number),
	/**
	A floating-point [number](#highlight.tags.number) literal.
	*/
	float: t(number),
	/**
	A boolean [literal](#highlight.tags.literal).
	*/
	bool: t(literal),
	/**
	Regular expression [literal](#highlight.tags.literal).
	*/
	regexp: t(literal),
	/**
	An escape [literal](#highlight.tags.literal), for example a
	backslash escape in a string.
	*/
	escape: t(literal),
	/**
	A color [literal](#highlight.tags.literal).
	*/
	color: t(literal),
	/**
	A URL [literal](#highlight.tags.literal).
	*/
	url: t(literal),
	/**
	A language keyword.
	*/
	keyword,
	/**
	The [keyword](#highlight.tags.keyword) for the self or this
	object.
	*/
	self: t(keyword),
	/**
	The [keyword](#highlight.tags.keyword) for null.
	*/
	null: t(keyword),
	/**
	A [keyword](#highlight.tags.keyword) denoting some atomic value.
	*/
	atom: t(keyword),
	/**
	A [keyword](#highlight.tags.keyword) that represents a unit.
	*/
	unit: t(keyword),
	/**
	A modifier [keyword](#highlight.tags.keyword).
	*/
	modifier: t(keyword),
	/**
	A [keyword](#highlight.tags.keyword) that acts as an operator.
	*/
	operatorKeyword: t(keyword),
	/**
	A control-flow related [keyword](#highlight.tags.keyword).
	*/
	controlKeyword: t(keyword),
	/**
	A [keyword](#highlight.tags.keyword) that defines something.
	*/
	definitionKeyword: t(keyword),
	/**
	A [keyword](#highlight.tags.keyword) related to defining or
	interfacing with modules.
	*/
	moduleKeyword: t(keyword),
	/**
	An operator.
	*/
	operator,
	/**
	An [operator](#highlight.tags.operator) that dereferences something.
	*/
	derefOperator: t(operator),
	/**
	Arithmetic-related [operator](#highlight.tags.operator).
	*/
	arithmeticOperator: t(operator),
	/**
	Logical [operator](#highlight.tags.operator).
	*/
	logicOperator: t(operator),
	/**
	Bit [operator](#highlight.tags.operator).
	*/
	bitwiseOperator: t(operator),
	/**
	Comparison [operator](#highlight.tags.operator).
	*/
	compareOperator: t(operator),
	/**
	[Operator](#highlight.tags.operator) that updates its operand.
	*/
	updateOperator: t(operator),
	/**
	[Operator](#highlight.tags.operator) that defines something.
	*/
	definitionOperator: t(operator),
	/**
	Type-related [operator](#highlight.tags.operator).
	*/
	typeOperator: t(operator),
	/**
	Control-flow [operator](#highlight.tags.operator).
	*/
	controlOperator: t(operator),
	/**
	Program or markup punctuation.
	*/
	punctuation,
	/**
	[Punctuation](#highlight.tags.punctuation) that separates
	things.
	*/
	separator: t(punctuation),
	/**
	Bracket-style [punctuation](#highlight.tags.punctuation).
	*/
	bracket,
	/**
	Angle [brackets](#highlight.tags.bracket) (usually `<` and `>`
	tokens).
	*/
	angleBracket: t(bracket),
	/**
	Square [brackets](#highlight.tags.bracket) (usually `[` and `]`
	tokens).
	*/
	squareBracket: t(bracket),
	/**
	Parentheses (usually `(` and `)` tokens). Subtag of
	[bracket](#highlight.tags.bracket).
	*/
	paren: t(bracket),
	/**
	Braces (usually `{` and `}` tokens). Subtag of
	[bracket](#highlight.tags.bracket).
	*/
	brace: t(bracket),
	/**
	Content, for example plain text in XML or markup documents.
	*/
	content,
	/**
	[Content](#highlight.tags.content) that represents a heading.
	*/
	heading,
	/**
	A level 1 [heading](#highlight.tags.heading).
	*/
	heading1: t(heading),
	/**
	A level 2 [heading](#highlight.tags.heading).
	*/
	heading2: t(heading),
	/**
	A level 3 [heading](#highlight.tags.heading).
	*/
	heading3: t(heading),
	/**
	A level 4 [heading](#highlight.tags.heading).
	*/
	heading4: t(heading),
	/**
	A level 5 [heading](#highlight.tags.heading).
	*/
	heading5: t(heading),
	/**
	A level 6 [heading](#highlight.tags.heading).
	*/
	heading6: t(heading),
	/**
	A prose [content](#highlight.tags.content) separator (such as a horizontal rule).
	*/
	contentSeparator: t(content),
	/**
	[Content](#highlight.tags.content) that represents a list.
	*/
	list: t(content),
	/**
	[Content](#highlight.tags.content) that represents a quote.
	*/
	quote: t(content),
	/**
	[Content](#highlight.tags.content) that is emphasized.
	*/
	emphasis: t(content),
	/**
	[Content](#highlight.tags.content) that is styled strong.
	*/
	strong: t(content),
	/**
	[Content](#highlight.tags.content) that is part of a link.
	*/
	link: t(content),
	/**
	[Content](#highlight.tags.content) that is styled as code or
	monospace.
	*/
	monospace: t(content),
	/**
	[Content](#highlight.tags.content) that has a strike-through
	style.
	*/
	strikethrough: t(content),
	/**
	Inserted text in a change-tracking format.
	*/
	inserted: t(),
	/**
	Deleted text.
	*/
	deleted: t(),
	/**
	Changed text.
	*/
	changed: t(),
	/**
	An invalid or unsyntactic element.
	*/
	invalid: t(),
	/**
	Metadata or meta-instruction.
	*/
	meta,
	/**
	[Metadata](#highlight.tags.meta) that applies to the entire
	document.
	*/
	documentMeta: t(meta),
	/**
	[Metadata](#highlight.tags.meta) that annotates or adds
	attributes to a given syntactic element.
	*/
	annotation: t(meta),
	/**
	Processing instruction or preprocessor directive. Subtag of
	[meta](#highlight.tags.meta).
	*/
	processingInstruction: t(meta),
	/**
	[Modifier](#highlight.Tag^defineModifier) that indicates that a
	given element is being defined. Expected to be used with the
	various [name](#highlight.tags.name) tags.
	*/
	definition: Tag.defineModifier("definition"),
	/**
	[Modifier](#highlight.Tag^defineModifier) that indicates that
	something is constant. Mostly expected to be used with
	[variable names](#highlight.tags.variableName).
	*/
	constant: Tag.defineModifier("constant"),
	/**
	[Modifier](#highlight.Tag^defineModifier) used to indicate that
	a [variable](#highlight.tags.variableName) or [property
	name](#highlight.tags.propertyName) is being called or defined
	as a function.
	*/
	function: Tag.defineModifier("function"),
	/**
	[Modifier](#highlight.Tag^defineModifier) that can be applied to
	[names](#highlight.tags.name) to indicate that they belong to
	the language's standard environment.
	*/
	standard: Tag.defineModifier("standard"),
	/**
	[Modifier](#highlight.Tag^defineModifier) that indicates a given
	[names](#highlight.tags.name) is local to some scope.
	*/
	local: Tag.defineModifier("local"),
	/**
	A generic variant [modifier](#highlight.Tag^defineModifier) that
	can be used to tag language-specific alternative variants of
	some common tag. It is recommended for themes to define special
	forms of at least the [string](#highlight.tags.string) and
	[variable name](#highlight.tags.variableName) tags, since those
	come up a lot.
	*/
	special: Tag.defineModifier("special")
};
for (let name in tags) {
	let val = tags[name];
	if (val instanceof Tag) val.name = name;
}
tagHighlighter([
	{
		tag: tags.link,
		class: "tok-link"
	},
	{
		tag: tags.heading,
		class: "tok-heading"
	},
	{
		tag: tags.emphasis,
		class: "tok-emphasis"
	},
	{
		tag: tags.strong,
		class: "tok-strong"
	},
	{
		tag: tags.keyword,
		class: "tok-keyword"
	},
	{
		tag: tags.atom,
		class: "tok-atom"
	},
	{
		tag: tags.bool,
		class: "tok-bool"
	},
	{
		tag: tags.url,
		class: "tok-url"
	},
	{
		tag: tags.labelName,
		class: "tok-labelName"
	},
	{
		tag: tags.inserted,
		class: "tok-inserted"
	},
	{
		tag: tags.deleted,
		class: "tok-deleted"
	},
	{
		tag: tags.literal,
		class: "tok-literal"
	},
	{
		tag: tags.string,
		class: "tok-string"
	},
	{
		tag: tags.number,
		class: "tok-number"
	},
	{
		tag: [
			tags.regexp,
			tags.escape,
			tags.special(tags.string)
		],
		class: "tok-string2"
	},
	{
		tag: tags.variableName,
		class: "tok-variableName"
	},
	{
		tag: tags.local(tags.variableName),
		class: "tok-variableName tok-local"
	},
	{
		tag: tags.definition(tags.variableName),
		class: "tok-variableName tok-definition"
	},
	{
		tag: tags.special(tags.variableName),
		class: "tok-variableName2"
	},
	{
		tag: tags.definition(tags.propertyName),
		class: "tok-propertyName tok-definition"
	},
	{
		tag: tags.typeName,
		class: "tok-typeName"
	},
	{
		tag: tags.namespace,
		class: "tok-namespace"
	},
	{
		tag: tags.className,
		class: "tok-className"
	},
	{
		tag: tags.macroName,
		class: "tok-macroName"
	},
	{
		tag: tags.propertyName,
		class: "tok-propertyName"
	},
	{
		tag: tags.operator,
		class: "tok-operator"
	},
	{
		tag: tags.comment,
		class: "tok-comment"
	},
	{
		tag: tags.meta,
		class: "tok-meta"
	},
	{
		tag: tags.invalid,
		class: "tok-invalid"
	},
	{
		tag: tags.punctuation,
		class: "tok-punctuation"
	}
]);
//#endregion
//#region node_modules/@codemirror/language/dist/index.js
var _a;
/**
Node prop stored in a parser's top syntax node to provide the
facet that stores language-specific data for that language.
*/
var languageDataProp = /* @__PURE__ */ new NodeProp();
/**
Helper function to define a facet (to be added to the top syntax
node(s) for a language via
[`languageDataProp`](https://codemirror.net/6/docs/ref/#language.languageDataProp)), that will be
used to associate language data with the language. You
probably only need this when subclassing
[`Language`](https://codemirror.net/6/docs/ref/#language.Language).
*/
function defineLanguageFacet(baseData) {
	return Facet.define({ combine: baseData ? (values) => values.concat(baseData) : void 0 });
}
/**
Syntax node prop used to register sublanguages. Should be added to
the top level node type for the language.
*/
var sublanguageProp = /* @__PURE__ */ new NodeProp();
/**
A language object manages parsing and per-language
[metadata](https://codemirror.net/6/docs/ref/#state.EditorState.languageDataAt). Parse data is
managed as a [Lezer](https://lezer.codemirror.net) tree. The class
can be used directly, via the [`LRLanguage`](https://codemirror.net/6/docs/ref/#language.LRLanguage)
subclass for [Lezer](https://lezer.codemirror.net/) LR parsers, or
via the [`StreamLanguage`](https://codemirror.net/6/docs/ref/#language.StreamLanguage) subclass
for stream parsers.
*/
var Language = class {
	/**
	Construct a language object. If you need to invoke this
	directly, first define a data facet with
	[`defineLanguageFacet`](https://codemirror.net/6/docs/ref/#language.defineLanguageFacet), and then
	configure your parser to [attach](https://codemirror.net/6/docs/ref/#language.languageDataProp) it
	to the language's outer syntax node.
	*/
	constructor(data, parser, extraExtensions = [], name = "") {
		this.data = data;
		this.name = name;
		if (!EditorState.prototype.hasOwnProperty("tree")) Object.defineProperty(EditorState.prototype, "tree", { get() {
			return syntaxTree(this);
		} });
		this.parser = parser;
		this.extension = [language.of(this), EditorState.languageData.of((state, pos, side) => {
			let top = topNodeAt(state, pos, side), data = top.type.prop(languageDataProp);
			if (!data) return [];
			let base = state.facet(data), sub = top.type.prop(sublanguageProp);
			if (sub) {
				let innerNode = top.resolve(pos - top.from, side);
				for (let sublang of sub) if (sublang.test(innerNode, state)) {
					let data = state.facet(sublang.facet);
					return sublang.type == "replace" ? data : data.concat(base);
				}
			}
			return base;
		})].concat(extraExtensions);
	}
	/**
	Query whether this language is active at the given position.
	*/
	isActiveAt(state, pos, side = -1) {
		return topNodeAt(state, pos, side).type.prop(languageDataProp) == this.data;
	}
	/**
	Find the document regions that were parsed using this language.
	The returned regions will _include_ any nested languages rooted
	in this language, when those exist.
	*/
	findRegions(state) {
		let lang = state.facet(language);
		if ((lang === null || lang === void 0 ? void 0 : lang.data) == this.data) return [{
			from: 0,
			to: state.doc.length
		}];
		if (!lang || !lang.allowsNesting) return [];
		let result = [];
		let explore = (tree, from) => {
			if (tree.prop(languageDataProp) == this.data) {
				result.push({
					from,
					to: from + tree.length
				});
				return;
			}
			let mount = tree.prop(NodeProp.mounted);
			if (mount) {
				if (mount.tree.prop(languageDataProp) == this.data) {
					if (mount.overlay) for (let r of mount.overlay) result.push({
						from: r.from + from,
						to: r.to + from
					});
					else result.push({
						from,
						to: from + tree.length
					});
					return;
				} else if (mount.overlay) {
					let size = result.length;
					explore(mount.tree, mount.overlay[0].from + from);
					if (result.length > size) return;
				}
			}
			for (let i = 0; i < tree.children.length; i++) {
				let ch = tree.children[i];
				if (ch instanceof Tree) explore(ch, tree.positions[i] + from);
			}
		};
		explore(syntaxTree(state), 0);
		return result;
	}
	/**
	Indicates whether this language allows nested languages. The
	default implementation returns true.
	*/
	get allowsNesting() {
		return true;
	}
};
/**
@internal
*/
Language.setState = /* @__PURE__ */ StateEffect.define();
function topNodeAt(state, pos, side) {
	let topLang = state.facet(language), tree = syntaxTree(state).topNode;
	if (!topLang || topLang.allowsNesting) {
		for (let node = tree; node; node = node.enter(pos, side, IterMode.ExcludeBuffers | IterMode.EnterBracketed)) if (node.type.isTop) tree = node;
	}
	return tree;
}
/**
A subclass of [`Language`](https://codemirror.net/6/docs/ref/#language.Language) for use with Lezer
[LR parsers](https://lezer.codemirror.net/docs/ref#lr.LRParser)
parsers.
*/
var LRLanguage = class LRLanguage extends Language {
	constructor(data, parser, name) {
		super(data, parser, [], name);
		this.parser = parser;
	}
	/**
	Define a language from a parser.
	*/
	static define(spec) {
		let data = defineLanguageFacet(spec.languageData);
		return new LRLanguage(data, spec.parser.configure({ props: [languageDataProp.add((type) => type.isTop ? data : void 0)] }), spec.name);
	}
	/**
	Create a new instance of this language with a reconfigured
	version of its parser and optionally a new name.
	*/
	configure(options, name) {
		return new LRLanguage(this.data, this.parser.configure(options), name || this.name);
	}
	get allowsNesting() {
		return this.parser.hasWrappers();
	}
};
/**
Get the syntax tree for a state, which is the current (possibly
incomplete) parse tree of the active
[language](https://codemirror.net/6/docs/ref/#language.Language), or the empty tree if there is no
language available.
*/
function syntaxTree(state) {
	let field = state.field(Language.state, false);
	return field ? field.tree : Tree.empty;
}
/**
Try to get a parse tree that spans at least up to `upto`. The
method will do at most `timeout` milliseconds of work to parse
up to that point if the tree isn't already available.
*/
function ensureSyntaxTree(state, upto, timeout = 50) {
	var _a;
	let parse = (_a = state.field(Language.state, false)) === null || _a === void 0 ? void 0 : _a.context;
	if (!parse) return null;
	let oldVieport = parse.viewport;
	parse.updateViewport({
		from: 0,
		to: upto
	});
	let result = parse.isDone(upto) || parse.work(timeout, upto) ? parse.tree : null;
	parse.updateViewport(oldVieport);
	return result;
}
/**
Queries whether there is a full syntax tree available up to the
given document position. If there isn't, the background parse
process _might_ still be working and update the tree further, but
there is no guarantee of that—the parser will [stop
working](https://codemirror.net/6/docs/ref/#language.syntaxParserRunning) when it has spent a
certain amount of time or has moved beyond the visible viewport.
Always returns false if no language has been enabled.
*/
function syntaxTreeAvailable(state, upto = state.doc.length) {
	var _a;
	return ((_a = state.field(Language.state, false)) === null || _a === void 0 ? void 0 : _a.context.isDone(upto)) || false;
}
/**
Move parsing forward, and update the editor state afterwards to
reflect the new tree. Will work for at most `timeout`
milliseconds. Returns true if the parser managed get to the given
position in that time.
*/
function forceParsing(view, upto = view.viewport.to, timeout = 100) {
	let success = ensureSyntaxTree(view.state, upto, timeout);
	if (success != syntaxTree(view.state)) view.dispatch({});
	return !!success;
}
/**
Tells you whether the language parser is planning to do more
parsing work (in a `requestIdleCallback` pseudo-thread) or has
stopped running, either because it parsed the entire document,
because it spent too much time and was cut off, or because there
is no language parser enabled.
*/
function syntaxParserRunning(view) {
	var _a;
	return ((_a = view.plugin(parseWorker)) === null || _a === void 0 ? void 0 : _a.isWorking()) || false;
}
/**
Lezer-style
[`Input`](https://lezer.codemirror.net/docs/ref#common.Input)
object for a [`Text`](https://codemirror.net/6/docs/ref/#state.Text) object.
*/
var DocInput = class {
	/**
	Create an input object for the given document.
	*/
	constructor(doc) {
		this.doc = doc;
		this.cursorPos = 0;
		this.string = "";
		this.cursor = doc.iter();
	}
	get length() {
		return this.doc.length;
	}
	syncTo(pos) {
		this.string = this.cursor.next(pos - this.cursorPos).value;
		this.cursorPos = pos + this.string.length;
		return this.cursorPos - this.string.length;
	}
	chunk(pos) {
		this.syncTo(pos);
		return this.string;
	}
	get lineChunks() {
		return true;
	}
	read(from, to) {
		let stringStart = this.cursorPos - this.string.length;
		if (from < stringStart || to >= this.cursorPos) return this.doc.sliceString(from, to);
		else return this.string.slice(from - stringStart, to - stringStart);
	}
};
var currentContext = null;
/**
A parse context provided to parsers working on the editor content.
*/
var ParseContext = class ParseContext {
	constructor(parser, state, fragments = [], tree, treeLen, viewport, skipped, scheduleOn) {
		this.parser = parser;
		this.state = state;
		this.fragments = fragments;
		this.tree = tree;
		this.treeLen = treeLen;
		this.viewport = viewport;
		this.skipped = skipped;
		this.scheduleOn = scheduleOn;
		this.parse = null;
		/**
		@internal
		*/
		this.tempSkipped = [];
	}
	/**
	@internal
	*/
	static create(parser, state, viewport) {
		return new ParseContext(parser, state, [], Tree.empty, 0, viewport, [], null);
	}
	startParse() {
		return this.parser.startParse(new DocInput(this.state.doc), this.fragments);
	}
	/**
	@internal
	*/
	work(until, upto) {
		if (upto != null && upto >= this.state.doc.length) upto = void 0;
		if (this.tree != Tree.empty && this.isDone(upto !== null && upto !== void 0 ? upto : this.state.doc.length)) {
			this.takeTree();
			return true;
		}
		return this.withContext(() => {
			var _a;
			if (typeof until == "number") {
				let endTime = Date.now() + until;
				until = () => Date.now() > endTime;
			}
			if (!this.parse) this.parse = this.startParse();
			if (upto != null && (this.parse.stoppedAt == null || this.parse.stoppedAt > upto) && upto < this.state.doc.length) this.parse.stopAt(upto);
			for (;;) {
				let done = this.parse.advance();
				if (done) {
					this.fragments = this.withoutTempSkipped(TreeFragment.addTree(done, this.fragments, this.parse.stoppedAt != null));
					this.treeLen = (_a = this.parse.stoppedAt) !== null && _a !== void 0 ? _a : this.state.doc.length;
					this.tree = done;
					this.parse = null;
					if (this.treeLen < (upto !== null && upto !== void 0 ? upto : this.state.doc.length)) this.parse = this.startParse();
					else return true;
				}
				if (until()) return false;
			}
		});
	}
	/**
	@internal
	*/
	takeTree() {
		let pos, tree;
		if (this.parse && (pos = this.parse.parsedPos) >= this.treeLen) {
			if (this.parse.stoppedAt == null || this.parse.stoppedAt > pos) this.parse.stopAt(pos);
			this.withContext(() => {
				while (!(tree = this.parse.advance()));
			});
			this.treeLen = pos;
			this.tree = tree;
			this.fragments = this.withoutTempSkipped(TreeFragment.addTree(this.tree, this.fragments, true));
			this.parse = null;
		}
	}
	withContext(f) {
		let prev = currentContext;
		currentContext = this;
		try {
			return f();
		} finally {
			currentContext = prev;
		}
	}
	withoutTempSkipped(fragments) {
		for (let r; r = this.tempSkipped.pop();) fragments = cutFragments(fragments, r.from, r.to);
		return fragments;
	}
	/**
	@internal
	*/
	changes(changes, newState) {
		let { fragments, tree, treeLen, viewport, skipped } = this;
		this.takeTree();
		if (!changes.empty) {
			let ranges = [];
			changes.iterChangedRanges((fromA, toA, fromB, toB) => ranges.push({
				fromA,
				toA,
				fromB,
				toB
			}));
			fragments = TreeFragment.applyChanges(fragments, ranges);
			tree = Tree.empty;
			treeLen = 0;
			viewport = {
				from: changes.mapPos(viewport.from, -1),
				to: changes.mapPos(viewport.to, 1)
			};
			if (this.skipped.length) {
				skipped = [];
				for (let r of this.skipped) {
					let from = changes.mapPos(r.from, 1), to = changes.mapPos(r.to, -1);
					if (from < to) skipped.push({
						from,
						to
					});
				}
			}
		}
		return new ParseContext(this.parser, newState, fragments, tree, treeLen, viewport, skipped, this.scheduleOn);
	}
	/**
	@internal
	*/
	updateViewport(viewport) {
		if (this.viewport.from == viewport.from && this.viewport.to == viewport.to) return false;
		this.viewport = viewport;
		let startLen = this.skipped.length;
		for (let i = 0; i < this.skipped.length; i++) {
			let { from, to } = this.skipped[i];
			if (from < viewport.to && to > viewport.from) {
				this.fragments = cutFragments(this.fragments, from, to);
				this.skipped.splice(i--, 1);
			}
		}
		if (this.skipped.length >= startLen) return false;
		this.reset();
		return true;
	}
	/**
	@internal
	*/
	reset() {
		if (this.parse) {
			this.takeTree();
			this.parse = null;
		}
	}
	/**
	Notify the parse scheduler that the given region was skipped
	because it wasn't in view, and the parse should be restarted
	when it comes into view.
	*/
	skipUntilInView(from, to) {
		this.skipped.push({
			from,
			to
		});
	}
	/**
	Returns a parser intended to be used as placeholder when
	asynchronously loading a nested parser. It'll skip its input and
	mark it as not-really-parsed, so that the next update will parse
	it again.
	
	When `until` is given, a reparse will be scheduled when that
	promise resolves.
	*/
	static getSkippingParser(until) {
		return new class extends Parser {
			createParse(input, fragments, ranges) {
				let from = ranges[0].from, to = ranges[ranges.length - 1].to;
				return {
					parsedPos: from,
					advance() {
						let cx = currentContext;
						if (cx) {
							for (let r of ranges) cx.tempSkipped.push(r);
							if (until) cx.scheduleOn = cx.scheduleOn ? Promise.all([cx.scheduleOn, until]) : until;
						}
						this.parsedPos = to;
						return new Tree(NodeType.none, [], [], to - from);
					},
					stoppedAt: null,
					stopAt() {}
				};
			}
		}();
	}
	/**
	@internal
	*/
	isDone(upto) {
		upto = Math.min(upto, this.state.doc.length);
		let frags = this.fragments;
		return this.treeLen >= upto && frags.length && frags[0].from == 0 && frags[0].to >= upto;
	}
	/**
	Get the context for the current parse, or `null` if no editor
	parse is in progress.
	*/
	static get() {
		return currentContext;
	}
};
function cutFragments(fragments, from, to) {
	return TreeFragment.applyChanges(fragments, [{
		fromA: from,
		toA: to,
		fromB: from,
		toB: to
	}]);
}
var LanguageState = class LanguageState {
	constructor(context) {
		this.context = context;
		this.tree = context.tree;
	}
	apply(tr) {
		if (!tr.docChanged && this.tree == this.context.tree) return this;
		let newCx = this.context.changes(tr.changes, tr.state);
		let upto = this.context.treeLen == tr.startState.doc.length ? void 0 : Math.max(tr.changes.mapPos(this.context.treeLen), newCx.viewport.to);
		if (!newCx.work(20, upto)) newCx.takeTree();
		return new LanguageState(newCx);
	}
	static init(state) {
		let vpTo = Math.min(3e3, state.doc.length);
		let parseState = ParseContext.create(state.facet(language).parser, state, {
			from: 0,
			to: vpTo
		});
		if (!parseState.work(20, vpTo)) parseState.takeTree();
		return new LanguageState(parseState);
	}
};
Language.state = /* @__PURE__ */ StateField.define({
	create: LanguageState.init,
	update(value, tr) {
		for (let e of tr.effects) if (e.is(Language.setState)) return e.value;
		if (tr.startState.facet(language) != tr.state.facet(language)) return LanguageState.init(tr.state);
		return value.apply(tr);
	}
});
var requestIdle = (callback) => {
	let timeout = setTimeout(() => callback(), 500);
	return () => clearTimeout(timeout);
};
if (typeof requestIdleCallback != "undefined") requestIdle = (callback) => {
	let idle = -1, timeout = setTimeout(() => {
		idle = requestIdleCallback(callback, { timeout: 400 });
	}, 100);
	return () => idle < 0 ? clearTimeout(timeout) : cancelIdleCallback(idle);
};
var isInputPending = typeof navigator != "undefined" && ((_a = navigator.scheduling) === null || _a === void 0 ? void 0 : _a.isInputPending) ? () => navigator.scheduling.isInputPending() : null;
var parseWorker = /* @__PURE__ */ ViewPlugin.fromClass(class ParseWorker {
	constructor(view) {
		this.view = view;
		this.working = null;
		this.workScheduled = 0;
		this.chunkEnd = -1;
		this.chunkBudget = -1;
		this.work = this.work.bind(this);
		this.scheduleWork();
	}
	update(update) {
		let cx = this.view.state.field(Language.state).context;
		if (cx.updateViewport(update.view.viewport) || this.view.viewport.to > cx.treeLen) this.scheduleWork();
		if (update.docChanged || update.selectionSet) {
			if (this.view.hasFocus) this.chunkBudget += 50;
			this.scheduleWork();
		}
		this.checkAsyncSchedule(cx);
	}
	scheduleWork() {
		if (this.working) return;
		let { state } = this.view, field = state.field(Language.state);
		if (field.tree != field.context.tree || !field.context.isDone(state.doc.length)) this.working = requestIdle(this.work);
	}
	work(deadline) {
		this.working = null;
		let now = Date.now();
		if (this.chunkEnd < now && (this.chunkEnd < 0 || this.view.hasFocus)) {
			this.chunkEnd = now + 3e4;
			this.chunkBudget = 3e3;
		}
		if (this.chunkBudget <= 0) return;
		let { state, viewport: { to: vpTo } } = this.view, field = state.field(Language.state);
		if (field.tree == field.context.tree && field.context.isDone(vpTo + 1e5)) return;
		let endTime = Date.now() + Math.min(this.chunkBudget, 100, deadline && !isInputPending ? Math.max(25, deadline.timeRemaining() - 5) : 1e9);
		let viewportFirst = field.context.treeLen < vpTo && state.doc.length > vpTo + 1e3;
		let done = field.context.work(() => {
			return isInputPending && isInputPending() || Date.now() > endTime;
		}, vpTo + (viewportFirst ? 0 : 1e5));
		this.chunkBudget -= Date.now() - now;
		if (done || this.chunkBudget <= 0) {
			field.context.takeTree();
			this.view.dispatch({ effects: Language.setState.of(new LanguageState(field.context)) });
		}
		if (this.chunkBudget > 0 && !(done && !viewportFirst)) this.scheduleWork();
		this.checkAsyncSchedule(field.context);
	}
	checkAsyncSchedule(cx) {
		if (cx.scheduleOn) {
			this.workScheduled++;
			cx.scheduleOn.then(() => this.scheduleWork()).catch((err) => logException(this.view.state, err)).then(() => this.workScheduled--);
			cx.scheduleOn = null;
		}
	}
	destroy() {
		if (this.working) this.working();
	}
	isWorking() {
		return !!(this.working || this.workScheduled > 0);
	}
}, { eventHandlers: { focus() {
	this.scheduleWork();
} } });
/**
The facet used to associate a language with an editor state. Used
by `Language` object's `extension` property (so you don't need to
manually wrap your languages in this). Can be used to access the
current language on a state.
*/
var language = /* @__PURE__ */ Facet.define({
	combine(languages) {
		return languages.length ? languages[0] : null;
	},
	enables: (language) => [
		Language.state,
		parseWorker,
		EditorView.contentAttributes.compute([language], (state) => {
			let lang = state.facet(language);
			return lang && lang.name ? { "data-language": lang.name } : {};
		})
	]
});
/**
This class bundles a [language](https://codemirror.net/6/docs/ref/#language.Language) with an
optional set of supporting extensions. Language packages are
encouraged to export a function that optionally takes a
configuration object and returns a `LanguageSupport` instance, as
the main way for client code to use the package.
*/
var LanguageSupport = class {
	/**
	Create a language support object.
	*/
	constructor(language, support = []) {
		this.language = language;
		this.support = support;
		this.extension = [language, support];
	}
};
/**
Language descriptions are used to store metadata about languages
and to dynamically load them. Their main role is finding the
appropriate language for a filename or dynamically loading nested
parsers.
*/
var LanguageDescription = class LanguageDescription {
	constructor(name, alias, extensions, filename, loadFunc, support = void 0) {
		this.name = name;
		this.alias = alias;
		this.extensions = extensions;
		this.filename = filename;
		this.loadFunc = loadFunc;
		this.support = support;
		this.loading = null;
	}
	/**
	Start loading the the language. Will return a promise that
	resolves to a [`LanguageSupport`](https://codemirror.net/6/docs/ref/#language.LanguageSupport)
	object when the language successfully loads.
	*/
	load() {
		return this.loading || (this.loading = this.loadFunc().then((support) => this.support = support, (err) => {
			this.loading = null;
			throw err;
		}));
	}
	/**
	Create a language description.
	*/
	static of(spec) {
		let { load, support } = spec;
		if (!load) {
			if (!support) throw new RangeError("Must pass either 'load' or 'support' to LanguageDescription.of");
			load = () => Promise.resolve(support);
		}
		return new LanguageDescription(spec.name, (spec.alias || []).concat(spec.name).map((s) => s.toLowerCase()), spec.extensions || [], spec.filename, load, support);
	}
	/**
	Look for a language in the given array of descriptions that
	matches the filename. Will first match
	[`filename`](https://codemirror.net/6/docs/ref/#language.LanguageDescription.filename) patterns,
	and then [extensions](https://codemirror.net/6/docs/ref/#language.LanguageDescription.extensions),
	and return the first language that matches.
	*/
	static matchFilename(descs, filename) {
		for (let d of descs) if (d.filename && d.filename.test(filename)) return d;
		let ext = /\.([^.]+)$/.exec(filename);
		if (ext) {
			for (let d of descs) if (d.extensions.indexOf(ext[1]) > -1) return d;
		}
		return null;
	}
	/**
	Look for a language whose name or alias matches the the given
	name (case-insensitively). If `fuzzy` is true, and no direct
	matchs is found, this'll also search for a language whose name
	or alias occurs in the string (for names shorter than three
	characters, only when surrounded by non-word characters).
	*/
	static matchLanguageName(descs, name, fuzzy = true) {
		name = name.toLowerCase();
		for (let d of descs) if (d.alias.some((a) => a == name)) return d;
		if (fuzzy) for (let d of descs) for (let a of d.alias) {
			let found = name.indexOf(a);
			if (found > -1 && (a.length > 2 || !/\w/.test(name[found - 1]) && !/\w/.test(name[found + a.length]))) return d;
		}
		return null;
	}
};
/**
Facet that defines a way to provide a function that computes the
appropriate indentation depth, as a column number (see
[`indentString`](https://codemirror.net/6/docs/ref/#language.indentString)), at the start of a given
line. A return value of `null` indicates no indentation can be
determined, and the line should inherit the indentation of the one
above it. A return value of `undefined` defers to the next indent
service.
*/
var indentService = /* @__PURE__ */ Facet.define();
/**
Facet for overriding the unit by which indentation happens. Should
be a string consisting entirely of the same whitespace character.
When not set, this defaults to 2 spaces.
*/
var indentUnit = /* @__PURE__ */ Facet.define({ combine: (values) => {
	if (!values.length) return "  ";
	let unit = values[0];
	if (!unit || /\S/.test(unit) || Array.from(unit).some((e) => e != unit[0])) throw new Error("Invalid indent unit: " + JSON.stringify(values[0]));
	return unit;
} });
/**
Return the _column width_ of an indent unit in the state.
Determined by the [`indentUnit`](https://codemirror.net/6/docs/ref/#language.indentUnit)
facet, and [`tabSize`](https://codemirror.net/6/docs/ref/#state.EditorState^tabSize) when that
contains tabs.
*/
function getIndentUnit(state) {
	let unit = state.facet(indentUnit);
	return unit.charCodeAt(0) == 9 ? state.tabSize * unit.length : unit.length;
}
/**
Create an indentation string that covers columns 0 to `cols`.
Will use tabs for as much of the columns as possible when the
[`indentUnit`](https://codemirror.net/6/docs/ref/#language.indentUnit) facet contains
tabs.
*/
function indentString(state, cols) {
	let result = "", ts = state.tabSize, ch = state.facet(indentUnit)[0];
	if (ch == "	") {
		while (cols >= ts) {
			result += "	";
			cols -= ts;
		}
		ch = " ";
	}
	for (let i = 0; i < cols; i++) result += ch;
	return result;
}
/**
Get the indentation, as a column number, at the given position.
Will first consult any [indent services](https://codemirror.net/6/docs/ref/#language.indentService)
that are registered, and if none of those return an indentation,
this will check the syntax tree for the [indent node
prop](https://codemirror.net/6/docs/ref/#language.indentNodeProp) and use that if found. Returns a
number when an indentation could be determined, and null
otherwise.
*/
function getIndentation(context, pos) {
	if (context instanceof EditorState) context = new IndentContext(context);
	for (let service of context.state.facet(indentService)) {
		let result = service(context, pos);
		if (result !== void 0) return result;
	}
	let tree = syntaxTree(context.state);
	return tree.length >= pos ? syntaxIndentation(context, tree, pos) : null;
}
/**
Create a change set that auto-indents all lines touched by the
given document range.
*/
function indentRange(state, from, to) {
	let updated = Object.create(null);
	let context = new IndentContext(state, { overrideIndentation: (start) => {
		var _a;
		return (_a = updated[start]) !== null && _a !== void 0 ? _a : -1;
	} });
	let changes = [];
	for (let pos = from; pos <= to;) {
		let line = state.doc.lineAt(pos);
		pos = line.to + 1;
		let indent = getIndentation(context, line.from);
		if (indent == null) continue;
		if (!/\S/.test(line.text)) indent = 0;
		let cur = /^\s*/.exec(line.text)[0];
		let norm = indentString(state, indent);
		if (cur != norm) {
			updated[line.from] = indent;
			changes.push({
				from: line.from,
				to: line.from + cur.length,
				insert: norm
			});
		}
	}
	return state.changes(changes);
}
/**
Indentation contexts are used when calling [indentation
services](https://codemirror.net/6/docs/ref/#language.indentService). They provide helper utilities
useful in indentation logic, and can selectively override the
indentation reported for some lines.
*/
var IndentContext = class {
	/**
	Create an indent context.
	*/
	constructor(state, options = {}) {
		this.state = state;
		this.options = options;
		this.unit = getIndentUnit(state);
	}
	/**
	Get a description of the line at the given position, taking
	[simulated line
	breaks](https://codemirror.net/6/docs/ref/#language.IndentContext.constructor^options.simulateBreak)
	into account. If there is such a break at `pos`, the `bias`
	argument determines whether the part of the line line before or
	after the break is used.
	*/
	lineAt(pos, bias = 1) {
		let line = this.state.doc.lineAt(pos);
		let { simulateBreak, simulateDoubleBreak } = this.options;
		if (simulateBreak != null && simulateBreak >= line.from && simulateBreak <= line.to) if (simulateDoubleBreak && simulateBreak == pos) return {
			text: "",
			from: pos
		};
		else if (bias < 0 ? simulateBreak < pos : simulateBreak <= pos) return {
			text: line.text.slice(simulateBreak - line.from),
			from: simulateBreak
		};
		else return {
			text: line.text.slice(0, simulateBreak - line.from),
			from: line.from
		};
		return line;
	}
	/**
	Get the text directly after `pos`, either the entire line
	or the next 100 characters, whichever is shorter.
	*/
	textAfterPos(pos, bias = 1) {
		if (this.options.simulateDoubleBreak && pos == this.options.simulateBreak) return "";
		let { text, from } = this.lineAt(pos, bias);
		return text.slice(pos - from, Math.min(text.length, pos + 100 - from));
	}
	/**
	Find the column for the given position.
	*/
	column(pos, bias = 1) {
		let { text, from } = this.lineAt(pos, bias);
		let result = this.countColumn(text, pos - from);
		let override = this.options.overrideIndentation ? this.options.overrideIndentation(from) : -1;
		if (override > -1) result += override - this.countColumn(text, text.search(/\S|$/));
		return result;
	}
	/**
	Find the column position (taking tabs into account) of the given
	position in the given string.
	*/
	countColumn(line, pos = line.length) {
		return countColumn(line, this.state.tabSize, pos);
	}
	/**
	Find the indentation column of the line at the given point.
	*/
	lineIndent(pos, bias = 1) {
		let { text, from } = this.lineAt(pos, bias);
		let override = this.options.overrideIndentation;
		if (override) {
			let overriden = override(from);
			if (overriden > -1) return overriden;
		}
		return this.countColumn(text, text.search(/\S|$/));
	}
	/**
	Returns the [simulated line
	break](https://codemirror.net/6/docs/ref/#language.IndentContext.constructor^options.simulateBreak)
	for this context, if any.
	*/
	get simulatedBreak() {
		return this.options.simulateBreak || null;
	}
};
/**
A syntax tree node prop used to associate indentation strategies
with node types. Such a strategy is a function from an indentation
context to a column number (see also
[`indentString`](https://codemirror.net/6/docs/ref/#language.indentString)) or null, where null
indicates that no definitive indentation can be determined.
*/
var indentNodeProp = /* @__PURE__ */ new NodeProp();
function syntaxIndentation(cx, ast, pos) {
	let stack = ast.resolveStack(pos);
	let inner = ast.resolveInner(pos, -1).resolve(pos, 0).enterUnfinishedNodesBefore(pos);
	if (inner != stack.node) {
		let add = [];
		for (let cur = inner; cur && !(cur.from < stack.node.from || cur.to > stack.node.to || cur.from == stack.node.from && cur.type == stack.node.type); cur = cur.parent) add.push(cur);
		for (let i = add.length - 1; i >= 0; i--) stack = {
			node: add[i],
			next: stack
		};
	}
	return indentFor(stack, cx, pos);
}
function indentFor(stack, cx, pos) {
	for (let cur = stack; cur; cur = cur.next) {
		let strategy = indentStrategy(cur.node);
		if (strategy) return strategy(TreeIndentContext.create(cx, pos, cur));
	}
	return 0;
}
function ignoreClosed(cx) {
	return cx.pos == cx.options.simulateBreak && cx.options.simulateDoubleBreak;
}
function indentStrategy(tree) {
	let strategy = tree.type.prop(indentNodeProp);
	if (strategy) return strategy;
	let first = tree.firstChild, close;
	if (first && (close = first.type.prop(NodeProp.closedBy))) {
		let last = tree.lastChild, closed = last && close.indexOf(last.name) > -1;
		return (cx) => delimitedStrategy(cx, true, 1, void 0, closed && !ignoreClosed(cx) ? last.from : void 0);
	}
	return tree.parent == null ? topIndent : null;
}
function topIndent() {
	return 0;
}
/**
Objects of this type provide context information and helper
methods to indentation functions registered on syntax nodes.
*/
var TreeIndentContext = class TreeIndentContext extends IndentContext {
	constructor(base, pos, context) {
		super(base.state, base.options);
		this.base = base;
		this.pos = pos;
		this.context = context;
	}
	/**
	The syntax tree node to which the indentation strategy
	applies.
	*/
	get node() {
		return this.context.node;
	}
	/**
	@internal
	*/
	static create(base, pos, context) {
		return new TreeIndentContext(base, pos, context);
	}
	/**
	Get the text directly after `this.pos`, either the entire line
	or the next 100 characters, whichever is shorter.
	*/
	get textAfter() {
		return this.textAfterPos(this.pos);
	}
	/**
	Get the indentation at the reference line for `this.node`, which
	is the line on which it starts, unless there is a node that is
	_not_ a parent of this node covering the start of that line. If
	so, the line at the start of that node is tried, again skipping
	on if it is covered by another such node.
	*/
	get baseIndent() {
		return this.baseIndentFor(this.node);
	}
	/**
	Get the indentation for the reference line of the given node
	(see [`baseIndent`](https://codemirror.net/6/docs/ref/#language.TreeIndentContext.baseIndent)).
	*/
	baseIndentFor(node) {
		let line = this.state.doc.lineAt(node.from);
		for (;;) {
			let atBreak = node.resolve(line.from);
			while (atBreak.parent && atBreak.parent.from == atBreak.from) atBreak = atBreak.parent;
			if (isParent(atBreak, node)) break;
			line = this.state.doc.lineAt(atBreak.from);
		}
		return this.lineIndent(line.from);
	}
	/**
	Continue looking for indentations in the node's parent nodes,
	and return the result of that.
	*/
	continue() {
		return indentFor(this.context.next, this.base, this.pos);
	}
};
function isParent(parent, of) {
	for (let cur = of; cur; cur = cur.parent) if (parent == cur) return true;
	return false;
}
function bracketedAligned(context) {
	let tree = context.node;
	let openToken = tree.childAfter(tree.from), last = tree.lastChild;
	if (!openToken) return null;
	let sim = context.options.simulateBreak;
	let openLine = context.state.doc.lineAt(openToken.from);
	let lineEnd = sim == null || sim <= openLine.from ? openLine.to : Math.min(openLine.to, sim);
	for (let pos = openToken.to;;) {
		let next = tree.childAfter(pos);
		if (!next || next == last) return null;
		if (!next.type.isSkipped) {
			if (next.from >= lineEnd) return null;
			let space = /^ */.exec(openLine.text.slice(openToken.to - openLine.from))[0].length;
			return {
				from: openToken.from,
				to: openToken.to + space
			};
		}
		pos = next.to;
	}
}
/**
An indentation strategy for delimited (usually bracketed) nodes.
Will, by default, indent one unit more than the parent's base
indent unless the line starts with a closing token. When `align`
is true and there are non-skipped nodes on the node's opening
line, the content of the node will be aligned with the end of the
opening node, like this:

foo(bar,
baz)
*/
function delimitedIndent({ closing, align = true, units = 1 }) {
	return (context) => delimitedStrategy(context, align, units, closing);
}
function delimitedStrategy(context, align, units, closing, closedAt) {
	let after = context.textAfter, space = after.match(/^\s*/)[0].length;
	let closed = closing && after.slice(space, space + closing.length) == closing || closedAt == context.pos + space;
	let aligned = align ? bracketedAligned(context) : null;
	if (aligned) return closed ? context.column(aligned.from) : context.column(aligned.to);
	return context.baseIndent + (closed ? 0 : context.unit * units);
}
/**
An indentation strategy that aligns a node's content to its base
indentation.
*/
var flatIndent = (context) => context.baseIndent;
/**
Creates an indentation strategy that, by default, indents
continued lines one unit more than the node's base indentation.
You can provide `except` to prevent indentation of lines that
match a pattern (for example `/^else\b/` in `if`/`else`
constructs), and you can change the amount of units used with the
`units` option.
*/
function continuedIndent({ except, units = 1 } = {}) {
	return (context) => {
		let matchExcept = except && except.test(context.textAfter);
		return context.baseIndent + (matchExcept ? 0 : units * context.unit);
	};
}
var DontIndentBeyond = 200;
/**
Enables reindentation on input. When a language defines an
`indentOnInput` field in its [language
data](https://codemirror.net/6/docs/ref/#state.EditorState.languageDataAt), which must hold a regular
expression, the line at the cursor will be reindented whenever new
text is typed and the input from the start of the line up to the
cursor matches that regexp.

To avoid unneccesary reindents, it is recommended to start the
regexp with `^` (usually followed by `\s*`), and end it with `$`.
For example, `/^\s*\}$/` will reindent when a closing brace is
added at the start of a line.
*/
function indentOnInput() {
	return EditorState.transactionFilter.of((tr) => {
		if (!tr.docChanged || !tr.isUserEvent("input.type") && !tr.isUserEvent("input.complete")) return tr;
		let rules = tr.startState.languageDataAt("indentOnInput", tr.startState.selection.main.head);
		if (!rules.length) return tr;
		let doc = tr.newDoc, { head } = tr.newSelection.main, line = doc.lineAt(head);
		if (head > line.from + DontIndentBeyond) return tr;
		let lineStart = doc.sliceString(line.from, head);
		if (!rules.some((r) => r.test(lineStart))) return tr;
		let { state } = tr, last = -1, changes = [];
		for (let { head } of state.selection.ranges) {
			let line = state.doc.lineAt(head);
			if (line.from == last) continue;
			last = line.from;
			let indent = getIndentation(state, line.from);
			if (indent == null) continue;
			let cur = /^\s*/.exec(line.text)[0];
			let norm = indentString(state, indent);
			if (cur != norm) changes.push({
				from: line.from,
				to: line.from + cur.length,
				insert: norm
			});
		}
		return changes.length ? [tr, {
			changes,
			sequential: true
		}] : tr;
	});
}
/**
A facet that registers a code folding service. When called with
the extent of a line, such a function should return a foldable
range that starts on that line (but continues beyond it), if one
can be found.
*/
var foldService = /* @__PURE__ */ Facet.define();
/**
This node prop is used to associate folding information with
syntax node types. Given a syntax node, it should check whether
that tree is foldable and return the range that can be collapsed
when it is.
*/
var foldNodeProp = /* @__PURE__ */ new NodeProp();
/**
[Fold](https://codemirror.net/6/docs/ref/#language.foldNodeProp) function that folds everything but
the first and the last child of a syntax node. Useful for nodes
that start and end with delimiters.
*/
function foldInside(node) {
	let first = node.firstChild, last = node.lastChild;
	return first && first.to < last.from ? {
		from: first.to,
		to: last.type.isError ? node.to : last.from
	} : null;
}
function syntaxFolding(state, start, end) {
	let tree = syntaxTree(state);
	if (tree.length < end) return null;
	let stack = tree.resolveStack(end, 1);
	let found = null;
	for (let iter = stack; iter; iter = iter.next) {
		let cur = iter.node;
		if (cur.to <= end || cur.from > end) continue;
		if (found && cur.from < start) break;
		let prop = cur.type.prop(foldNodeProp);
		if (prop && (cur.to < tree.length - 50 || tree.length == state.doc.length || !isUnfinished(cur))) {
			let value = prop(cur, state);
			if (value && value.from <= end && value.from >= start && value.to > end) found = value;
		}
	}
	return found;
}
function isUnfinished(node) {
	let ch = node.lastChild;
	return ch && ch.to == node.to && ch.type.isError;
}
/**
Check whether the given line is foldable. First asks any fold
services registered through
[`foldService`](https://codemirror.net/6/docs/ref/#language.foldService), and if none of them return
a result, tries to query the [fold node
prop](https://codemirror.net/6/docs/ref/#language.foldNodeProp) of syntax nodes that cover the end
of the line.
*/
function foldable(state, lineStart, lineEnd) {
	for (let service of state.facet(foldService)) {
		let result = service(state, lineStart, lineEnd);
		if (result) return result;
	}
	return syntaxFolding(state, lineStart, lineEnd);
}
function mapRange(range, mapping) {
	let from = mapping.mapPos(range.from, 1), to = mapping.mapPos(range.to, -1);
	return from >= to ? void 0 : {
		from,
		to
	};
}
/**
State effect that can be attached to a transaction to fold the
given range. (You probably only need this in exceptional
circumstances—usually you'll just want to let
[`foldCode`](https://codemirror.net/6/docs/ref/#language.foldCode) and the [fold
gutter](https://codemirror.net/6/docs/ref/#language.foldGutter) create the transactions.)
*/
var foldEffect = /* @__PURE__ */ StateEffect.define({ map: mapRange });
/**
State effect that unfolds the given range (if it was folded).
*/
var unfoldEffect = /* @__PURE__ */ StateEffect.define({ map: mapRange });
function selectedLines(view) {
	let lines = [];
	for (let { head } of view.state.selection.ranges) {
		if (lines.some((l) => l.from <= head && l.to >= head)) continue;
		lines.push(view.lineBlockAt(head));
	}
	return lines;
}
/**
The state field that stores the folded ranges (as a [decoration
set](https://codemirror.net/6/docs/ref/#view.DecorationSet)). Can be passed to
[`EditorState.toJSON`](https://codemirror.net/6/docs/ref/#state.EditorState.toJSON) and
[`fromJSON`](https://codemirror.net/6/docs/ref/#state.EditorState^fromJSON) to serialize the fold
state.
*/
var foldState = /* @__PURE__ */ StateField.define({
	create() {
		return Decoration.none;
	},
	update(folded, tr) {
		if (tr.isUserEvent("delete")) tr.changes.iterChangedRanges((fromA, toA) => folded = clearTouchedFolds(folded, fromA, toA));
		folded = folded.map(tr.changes);
		for (let e of tr.effects) if (e.is(foldEffect) && !foldExists(folded, e.value.from, e.value.to)) {
			let { preparePlaceholder } = tr.state.facet(foldConfig);
			let widget = !preparePlaceholder ? foldWidget : Decoration.replace({ widget: new PreparedFoldWidget(preparePlaceholder(tr.state, e.value)) });
			folded = folded.update({ add: [widget.range(e.value.from, e.value.to)] });
		} else if (e.is(unfoldEffect)) folded = folded.update({
			filter: (from, to) => e.value.from != from || e.value.to != to,
			filterFrom: e.value.from,
			filterTo: e.value.to
		});
		if (tr.selection) folded = clearTouchedFolds(folded, tr.selection.main.head);
		return folded;
	},
	provide: (f) => EditorView.decorations.from(f),
	toJSON(folded, state) {
		let ranges = [];
		folded.between(0, state.doc.length, (from, to) => {
			ranges.push(from, to);
		});
		return ranges;
	},
	fromJSON(value) {
		if (!Array.isArray(value) || value.length % 2) throw new RangeError("Invalid JSON for fold state");
		let ranges = [];
		for (let i = 0; i < value.length;) {
			let from = value[i++], to = value[i++];
			if (typeof from != "number" || typeof to != "number") throw new RangeError("Invalid JSON for fold state");
			ranges.push(foldWidget.range(from, to));
		}
		return Decoration.set(ranges, true);
	}
});
function clearTouchedFolds(folded, from, to = from) {
	let touched = false;
	folded.between(from, to, (a, b) => {
		if (a < to && b > from) touched = true;
	});
	return !touched ? folded : folded.update({
		filterFrom: from,
		filterTo: to,
		filter: (a, b) => a >= to || b <= from
	});
}
/**
Get a [range set](https://codemirror.net/6/docs/ref/#state.RangeSet) containing the folded ranges
in the given state.
*/
function foldedRanges(state) {
	return state.field(foldState, false) || RangeSet.empty;
}
function findFold(state, from, to) {
	var _a;
	let found = null;
	(_a = state.field(foldState, false)) === null || _a === void 0 || _a.between(from, to, (from, to) => {
		if (!found || found.from > from) found = {
			from,
			to
		};
	});
	return found;
}
function foldExists(folded, from, to) {
	let found = false;
	folded.between(from, from, (a, b) => {
		if (a == from && b == to) found = true;
	});
	return found;
}
function maybeEnable(state, other) {
	return state.field(foldState, false) ? other : other.concat(StateEffect.appendConfig.of(codeFolding()));
}
/**
Fold the lines that are selected, if possible.
*/
var foldCode = (view) => {
	for (let line of selectedLines(view)) {
		let range = foldable(view.state, line.from, line.to);
		if (range) {
			view.dispatch({ effects: maybeEnable(view.state, [foldEffect.of(range), announceFold(view, range)]) });
			return true;
		}
	}
	return false;
};
/**
Unfold folded ranges on selected lines.
*/
var unfoldCode = (view) => {
	if (!view.state.field(foldState, false)) return false;
	let effects = [];
	for (let line of selectedLines(view)) {
		let folded = findFold(view.state, line.from, line.to);
		if (folded) effects.push(unfoldEffect.of(folded), announceFold(view, folded, false));
	}
	if (effects.length) view.dispatch({ effects });
	return effects.length > 0;
};
function announceFold(view, range, fold = true) {
	let lineFrom = view.state.doc.lineAt(range.from).number, lineTo = view.state.doc.lineAt(range.to).number;
	return EditorView.announce.of(`${view.state.phrase(fold ? "Folded lines" : "Unfolded lines")} ${lineFrom} ${view.state.phrase("to")} ${lineTo}.`);
}
/**
Fold all top-level foldable ranges. Note that, in most cases,
folding information will depend on the [syntax
tree](https://codemirror.net/6/docs/ref/#language.syntaxTree), and folding everything may not work
reliably when the document hasn't been fully parsed (either
because the editor state was only just initialized, or because the
document is so big that the parser decided not to parse it
entirely).
*/
var foldAll = (view) => {
	let { state } = view, effects = [];
	for (let pos = 0; pos < state.doc.length;) {
		let line = view.lineBlockAt(pos), range = foldable(state, line.from, line.to);
		if (range) effects.push(foldEffect.of(range));
		pos = (range ? view.lineBlockAt(range.to) : line).to + 1;
	}
	if (effects.length) view.dispatch({ effects: maybeEnable(view.state, effects) });
	return !!effects.length;
};
/**
Unfold all folded code.
*/
var unfoldAll = (view) => {
	let field = view.state.field(foldState, false);
	if (!field || !field.size) return false;
	let effects = [];
	field.between(0, view.state.doc.length, (from, to) => {
		effects.push(unfoldEffect.of({
			from,
			to
		}));
	});
	view.dispatch({ effects });
	return true;
};
function foldableContainer(view, lineBlock) {
	for (let line = lineBlock;;) {
		let foldableRegion = foldable(view.state, line.from, line.to);
		if (foldableRegion && foldableRegion.to > lineBlock.from) return foldableRegion;
		if (!line.from) return null;
		line = view.lineBlockAt(line.from - 1);
	}
}
/**
Toggle folding at cursors. Unfolds if there is an existing fold
starting in that line, tries to find a foldable range around it
otherwise.
*/
var toggleFold = (view) => {
	let effects = [];
	for (let line of selectedLines(view)) {
		let folded = findFold(view.state, line.from, line.to);
		if (folded) effects.push(unfoldEffect.of(folded), announceFold(view, folded, false));
		else {
			let foldRange = foldableContainer(view, line);
			if (foldRange) effects.push(foldEffect.of(foldRange), announceFold(view, foldRange));
		}
	}
	if (effects.length > 0) view.dispatch({ effects: maybeEnable(view.state, effects) });
	return !!effects.length;
};
/**
Default fold-related key bindings.

- Ctrl-Shift-[ (Cmd-Alt-[ on macOS): [`foldCode`](https://codemirror.net/6/docs/ref/#language.foldCode).
- Ctrl-Shift-] (Cmd-Alt-] on macOS): [`unfoldCode`](https://codemirror.net/6/docs/ref/#language.unfoldCode).
- Ctrl-Alt-[: [`foldAll`](https://codemirror.net/6/docs/ref/#language.foldAll).
- Ctrl-Alt-]: [`unfoldAll`](https://codemirror.net/6/docs/ref/#language.unfoldAll).
*/
var foldKeymap = [
	{
		key: "Ctrl-Shift-[",
		mac: "Cmd-Alt-[",
		run: foldCode
	},
	{
		key: "Ctrl-Shift-]",
		mac: "Cmd-Alt-]",
		run: unfoldCode
	},
	{
		key: "Ctrl-Alt-[",
		run: foldAll
	},
	{
		key: "Ctrl-Alt-]",
		run: unfoldAll
	}
];
var defaultConfig = {
	placeholderDOM: null,
	preparePlaceholder: null,
	placeholderText: "…"
};
var foldConfig = /* @__PURE__ */ Facet.define({ combine(values) {
	return combineConfig(values, defaultConfig);
} });
/**
Create an extension that configures code folding.
*/
function codeFolding(config) {
	let result = [foldState, baseTheme$1];
	if (config) result.push(foldConfig.of(config));
	return result;
}
function widgetToDOM(view, prepared) {
	let { state } = view, conf = state.facet(foldConfig);
	let onclick = (event) => {
		let line = view.lineBlockAt(view.posAtDOM(event.target));
		let folded = findFold(view.state, line.from, line.to);
		if (folded) view.dispatch({ effects: unfoldEffect.of(folded) });
		event.preventDefault();
	};
	if (conf.placeholderDOM) return conf.placeholderDOM(view, onclick, prepared);
	let element = document.createElement("span");
	element.textContent = conf.placeholderText;
	element.setAttribute("aria-label", state.phrase("folded code"));
	element.title = state.phrase("unfold");
	element.className = "cm-foldPlaceholder";
	element.onclick = onclick;
	return element;
}
var foldWidget = /* @__PURE__ */ Decoration.replace({ widget: /* @__PURE__ */ new class extends WidgetType {
	toDOM(view) {
		return widgetToDOM(view, null);
	}
}() });
var PreparedFoldWidget = class extends WidgetType {
	constructor(value) {
		super();
		this.value = value;
	}
	eq(other) {
		return this.value == other.value;
	}
	toDOM(view) {
		return widgetToDOM(view, this.value);
	}
};
var foldGutterDefaults = {
	openText: "⌄",
	closedText: "›",
	markerDOM: null,
	domEventHandlers: {},
	foldingChanged: () => false
};
var FoldMarker = class extends GutterMarker {
	constructor(config, open) {
		super();
		this.config = config;
		this.open = open;
	}
	eq(other) {
		return this.config == other.config && this.open == other.open;
	}
	toDOM(view) {
		if (this.config.markerDOM) return this.config.markerDOM(this.open);
		let span = document.createElement("span");
		span.textContent = this.open ? this.config.openText : this.config.closedText;
		span.title = view.state.phrase(this.open ? "Fold line" : "Unfold line");
		return span;
	}
};
/**
Create an extension that registers a fold gutter, which shows a
fold status indicator before foldable lines (which can be clicked
to fold or unfold the line).
*/
function foldGutter(config = {}) {
	let fullConfig = {
		...foldGutterDefaults,
		...config
	};
	let canFold = new FoldMarker(fullConfig, true), canUnfold = new FoldMarker(fullConfig, false);
	let markers = ViewPlugin.fromClass(class {
		constructor(view) {
			this.from = view.viewport.from;
			this.markers = this.buildMarkers(view);
		}
		update(update) {
			if (update.docChanged || update.viewportChanged || update.startState.facet(language) != update.state.facet(language) || update.startState.field(foldState, false) != update.state.field(foldState, false) || syntaxTree(update.startState) != syntaxTree(update.state) || fullConfig.foldingChanged(update)) this.markers = this.buildMarkers(update.view);
		}
		buildMarkers(view) {
			let builder = new RangeSetBuilder();
			for (let line of view.viewportLineBlocks) {
				let mark = findFold(view.state, line.from, line.to) ? canUnfold : foldable(view.state, line.from, line.to) ? canFold : null;
				if (mark) builder.add(line.from, line.from, mark);
			}
			return builder.finish();
		}
	});
	let { domEventHandlers } = fullConfig;
	return [
		markers,
		gutter({
			class: "cm-foldGutter",
			markers(view) {
				var _a;
				return ((_a = view.plugin(markers)) === null || _a === void 0 ? void 0 : _a.markers) || RangeSet.empty;
			},
			initialSpacer() {
				return new FoldMarker(fullConfig, false);
			},
			domEventHandlers: {
				...domEventHandlers,
				click: (view, line, event) => {
					if (domEventHandlers.click && domEventHandlers.click(view, line, event)) return true;
					let folded = findFold(view.state, line.from, line.to);
					if (folded) {
						view.dispatch({ effects: unfoldEffect.of(folded) });
						return true;
					}
					let range = foldable(view.state, line.from, line.to);
					if (range) {
						view.dispatch({ effects: foldEffect.of(range) });
						return true;
					}
					return false;
				}
			}
		}),
		codeFolding()
	];
}
var baseTheme$1 = /* @__PURE__ */ EditorView.baseTheme({
	".cm-foldPlaceholder": {
		backgroundColor: "#eee",
		border: "1px solid #ddd",
		color: "#888",
		borderRadius: ".2em",
		margin: "0 1px",
		padding: "0 1px",
		cursor: "pointer"
	},
	".cm-foldGutter span": {
		padding: "0 1px",
		cursor: "pointer"
	}
});
/**
A highlight style associates CSS styles with highlighting
[tags](https://lezer.codemirror.net/docs/ref#highlight.Tag).
*/
var HighlightStyle = class HighlightStyle {
	constructor(specs, options) {
		this.specs = specs;
		let modSpec;
		function def(spec) {
			let cls = StyleModule.newName();
			(modSpec || (modSpec = Object.create(null)))["." + cls] = spec;
			return cls;
		}
		const all = typeof options.all == "string" ? options.all : options.all ? def(options.all) : void 0;
		const scopeOpt = options.scope;
		this.scope = scopeOpt instanceof Language ? (type) => type.prop(languageDataProp) == scopeOpt.data : scopeOpt ? (type) => type == scopeOpt : void 0;
		this.style = tagHighlighter(specs.map((style) => ({
			tag: style.tag,
			class: style.class || def(Object.assign({}, style, { tag: null }))
		})), { all }).style;
		this.module = modSpec ? new StyleModule(modSpec) : null;
		this.themeType = options.themeType;
	}
	/**
	Create a highlighter style that associates the given styles to
	the given tags. The specs must be objects that hold a style tag
	or array of tags in their `tag` property, and either a single
	`class` property providing a static CSS class (for highlighter
	that rely on external styling), or a
	[`style-mod`](https://github.com/marijnh/style-mod#documentation)-style
	set of CSS properties (which define the styling for those tags).
	
	The CSS rules created for a highlighter will be emitted in the
	order of the spec's properties. That means that for elements that
	have multiple tags associated with them, styles defined further
	down in the list will have a higher CSS precedence than styles
	defined earlier.
	*/
	static define(specs, options) {
		return new HighlightStyle(specs, options || {});
	}
};
var highlighterFacet = /* @__PURE__ */ Facet.define();
var fallbackHighlighter = /* @__PURE__ */ Facet.define({ combine(values) {
	return values.length ? [values[0]] : null;
} });
function getHighlighters(state) {
	let main = state.facet(highlighterFacet);
	return main.length ? main : state.facet(fallbackHighlighter);
}
/**
Wrap a highlighter in an editor extension that uses it to apply
syntax highlighting to the editor content.

When multiple (non-fallback) styles are provided, the styling
applied is the union of the classes they emit.
*/
function syntaxHighlighting(highlighter, options) {
	let ext = [treeHighlighter], themeType;
	if (highlighter instanceof HighlightStyle) {
		if (highlighter.module) ext.push(EditorView.styleModule.of(highlighter.module));
		themeType = highlighter.themeType;
	}
	if (options === null || options === void 0 ? void 0 : options.fallback) ext.push(fallbackHighlighter.of(highlighter));
	else if (themeType) ext.push(highlighterFacet.computeN([EditorView.darkTheme], (state) => {
		return state.facet(EditorView.darkTheme) == (themeType == "dark") ? [highlighter] : [];
	}));
	else ext.push(highlighterFacet.of(highlighter));
	return ext;
}
/**
Returns the CSS classes (if any) that the highlighters active in
the state would assign to the given style
[tags](https://lezer.codemirror.net/docs/ref#highlight.Tag) and
(optional) language
[scope](https://codemirror.net/6/docs/ref/#language.HighlightStyle^define^options.scope).
*/
function highlightingFor(state, tags, scope) {
	let highlighters = getHighlighters(state);
	let result = null;
	if (highlighters) {
		for (let highlighter of highlighters) if (!highlighter.scope || scope && highlighter.scope(scope)) {
			let cls = highlighter.style(tags);
			if (cls) result = result ? result + " " + cls : cls;
		}
	}
	return result;
}
var TreeHighlighter = class {
	constructor(view) {
		this.markCache = Object.create(null);
		this.tree = syntaxTree(view.state);
		this.decorations = this.buildDeco(view, getHighlighters(view.state));
		this.decoratedTo = view.viewport.to;
	}
	update(update) {
		let tree = syntaxTree(update.state), highlighters = getHighlighters(update.state);
		let styleChange = highlighters != getHighlighters(update.startState);
		let { viewport } = update.view, decoratedToMapped = update.changes.mapPos(this.decoratedTo, 1);
		if (tree.length < viewport.to && !styleChange && tree.type == this.tree.type && decoratedToMapped >= viewport.to) {
			this.decorations = this.decorations.map(update.changes);
			this.decoratedTo = decoratedToMapped;
		} else if (tree != this.tree || update.viewportChanged || styleChange) {
			this.tree = tree;
			this.decorations = this.buildDeco(update.view, highlighters);
			this.decoratedTo = viewport.to;
		}
	}
	buildDeco(view, highlighters) {
		if (!highlighters || !this.tree.length) return Decoration.none;
		let builder = new RangeSetBuilder();
		for (let { from, to } of view.visibleRanges) highlightTree(this.tree, highlighters, (from, to, style) => {
			builder.add(from, to, this.markCache[style] || (this.markCache[style] = Decoration.mark({ class: style })));
		}, from, to);
		return builder.finish();
	}
};
var treeHighlighter = /* @__PURE__ */ Prec.high(/* @__PURE__ */ ViewPlugin.fromClass(TreeHighlighter, { decorations: (v) => v.decorations }));
/**
A default highlight style (works well with light themes).
*/
var defaultHighlightStyle = /* @__PURE__ */ HighlightStyle.define([
	{
		tag: tags.meta,
		color: "#404740"
	},
	{
		tag: tags.link,
		textDecoration: "underline"
	},
	{
		tag: tags.heading,
		textDecoration: "underline",
		fontWeight: "bold"
	},
	{
		tag: tags.emphasis,
		fontStyle: "italic"
	},
	{
		tag: tags.strong,
		fontWeight: "bold"
	},
	{
		tag: tags.strikethrough,
		textDecoration: "line-through"
	},
	{
		tag: tags.keyword,
		color: "#708"
	},
	{
		tag: [
			tags.atom,
			tags.bool,
			tags.url,
			tags.contentSeparator,
			tags.labelName
		],
		color: "#219"
	},
	{
		tag: [tags.literal, tags.inserted],
		color: "#164"
	},
	{
		tag: [tags.string, tags.deleted],
		color: "#a11"
	},
	{
		tag: [
			tags.regexp,
			tags.escape,
			/* @__PURE__ */ tags.special(tags.string)
		],
		color: "#e40"
	},
	{
		tag: /* @__PURE__ */ tags.definition(tags.variableName),
		color: "#00f"
	},
	{
		tag: /* @__PURE__ */ tags.local(tags.variableName),
		color: "#30a"
	},
	{
		tag: [tags.typeName, tags.namespace],
		color: "#085"
	},
	{
		tag: tags.className,
		color: "#167"
	},
	{
		tag: [/* @__PURE__ */ tags.special(tags.variableName), tags.macroName],
		color: "#256"
	},
	{
		tag: /* @__PURE__ */ tags.definition(tags.propertyName),
		color: "#00c"
	},
	{
		tag: tags.comment,
		color: "#940"
	},
	{
		tag: tags.invalid,
		color: "#f00"
	}
]);
var baseTheme = /* @__PURE__ */ EditorView.baseTheme({
	"&.cm-focused .cm-matchingBracket": { backgroundColor: "#328c8252" },
	"&.cm-focused .cm-nonmatchingBracket": { backgroundColor: "#bb555544" }
});
var DefaultScanDist = 1e4, DefaultBrackets = "()[]{}";
var bracketMatchingConfig = /* @__PURE__ */ Facet.define({ combine(configs) {
	return combineConfig(configs, {
		afterCursor: true,
		brackets: DefaultBrackets,
		maxScanDistance: DefaultScanDist,
		renderMatch: defaultRenderMatch
	});
} });
var matchingMark = /* @__PURE__ */ Decoration.mark({ class: "cm-matchingBracket" }), nonmatchingMark = /* @__PURE__ */ Decoration.mark({ class: "cm-nonmatchingBracket" });
function defaultRenderMatch(match) {
	let decorations = [];
	let mark = match.matched ? matchingMark : nonmatchingMark;
	decorations.push(mark.range(match.start.from, match.start.to));
	if (match.end) decorations.push(mark.range(match.end.from, match.end.to));
	return decorations;
}
function bracketDeco(state) {
	let decorations = [];
	let config = state.facet(bracketMatchingConfig);
	for (let range of state.selection.ranges) {
		if (!range.empty) continue;
		let match = matchBrackets(state, range.head, -1, config) || range.head > 0 && matchBrackets(state, range.head - 1, 1, config) || config.afterCursor && (matchBrackets(state, range.head, 1, config) || range.head < state.doc.length && matchBrackets(state, range.head + 1, -1, config));
		if (match) decorations = decorations.concat(config.renderMatch(match, state));
	}
	return Decoration.set(decorations, true);
}
var bracketMatchingUnique = [/* @__PURE__ */ ViewPlugin.fromClass(class {
	constructor(view) {
		this.paused = false;
		this.decorations = bracketDeco(view.state);
	}
	update(update) {
		if (update.docChanged || update.selectionSet || this.paused) if (update.view.composing) {
			this.decorations = this.decorations.map(update.changes);
			this.paused = true;
		} else {
			this.decorations = bracketDeco(update.state);
			this.paused = false;
		}
	}
}, { decorations: (v) => v.decorations }), baseTheme];
/**
Create an extension that enables bracket matching. Whenever the
cursor is next to a bracket, that bracket and the one it matches
are highlighted. Or, when no matching bracket is found, another
highlighting style is used to indicate this.
*/
function bracketMatching(config = {}) {
	return [bracketMatchingConfig.of(config), bracketMatchingUnique];
}
/**
When larger syntax nodes, such as HTML tags, are marked as
opening/closing, it can be a bit messy to treat the whole node as
a matchable bracket. This node prop allows you to define, for such
a node, a ‘handle’—the part of the node that is highlighted, and
that the cursor must be on to activate highlighting in the first
place.
*/
var bracketMatchingHandle = /* @__PURE__ */ new NodeProp();
function matchingNodes(node, dir, brackets) {
	let byProp = node.prop(dir < 0 ? NodeProp.openedBy : NodeProp.closedBy);
	if (byProp) return byProp;
	if (node.name.length == 1) {
		let index = brackets.indexOf(node.name);
		if (index > -1 && index % 2 == (dir < 0 ? 1 : 0)) return [brackets[index + dir]];
	}
	return null;
}
function findHandle(node) {
	let hasHandle = node.type.prop(bracketMatchingHandle);
	return hasHandle ? hasHandle(node.node) : node;
}
/**
Find the matching bracket for the token at `pos`, scanning
direction `dir`. Only the `brackets` and `maxScanDistance`
properties are used from `config`, if given. Returns null if no
bracket was found at `pos`, or a match result otherwise.
*/
function matchBrackets(state, pos, dir, config = {}) {
	let maxScanDistance = config.maxScanDistance || DefaultScanDist, brackets = config.brackets || DefaultBrackets;
	let tree = syntaxTree(state), node = tree.resolveInner(pos, dir);
	for (let cur = node; cur; cur = cur.parent) {
		let matches = matchingNodes(cur.type, dir, brackets);
		if (matches && cur.from < cur.to) {
			let handle = findHandle(cur);
			if (handle && (dir > 0 ? pos >= handle.from && pos < handle.to : pos > handle.from && pos <= handle.to)) return matchMarkedBrackets(state, pos, dir, cur, handle, matches, brackets);
		}
	}
	return matchPlainBrackets(state, pos, dir, tree, node.type, maxScanDistance, brackets);
}
function matchMarkedBrackets(_state, _pos, dir, token, handle, matching, brackets) {
	let parent = token.parent, firstToken = {
		from: handle.from,
		to: handle.to
	};
	let depth = 0, cursor = parent === null || parent === void 0 ? void 0 : parent.cursor();
	if (cursor && (dir < 0 ? cursor.childBefore(token.from) : cursor.childAfter(token.to))) do
		if (dir < 0 ? cursor.to <= token.from : cursor.from >= token.to) {
			if (depth == 0 && matching.indexOf(cursor.type.name) > -1 && cursor.from < cursor.to) {
				let endHandle = findHandle(cursor);
				return {
					start: firstToken,
					end: endHandle ? {
						from: endHandle.from,
						to: endHandle.to
					} : void 0,
					matched: true
				};
			} else if (matchingNodes(cursor.type, dir, brackets)) depth++;
			else if (matchingNodes(cursor.type, -dir, brackets)) {
				if (depth == 0) {
					let endHandle = findHandle(cursor);
					return {
						start: firstToken,
						end: endHandle && endHandle.from < endHandle.to ? {
							from: endHandle.from,
							to: endHandle.to
						} : void 0,
						matched: false
					};
				}
				depth--;
			}
		}
	while (dir < 0 ? cursor.prevSibling() : cursor.nextSibling());
	return {
		start: firstToken,
		matched: false
	};
}
function matchPlainBrackets(state, pos, dir, tree, tokenType, maxScanDistance, brackets) {
	if (dir < 0 ? !pos : pos == state.doc.length) return null;
	let startCh = dir < 0 ? state.sliceDoc(pos - 1, pos) : state.sliceDoc(pos, pos + 1);
	let bracket = brackets.indexOf(startCh);
	if (bracket < 0 || bracket % 2 == 0 != dir > 0) return null;
	let startToken = {
		from: dir < 0 ? pos - 1 : pos,
		to: dir > 0 ? pos + 1 : pos
	};
	let iter = state.doc.iterRange(pos, dir > 0 ? state.doc.length : 0), depth = 0;
	for (let distance = 0; !iter.next().done && distance <= maxScanDistance;) {
		let text = iter.value;
		if (dir < 0) distance += text.length;
		let basePos = pos + distance * dir;
		for (let pos = dir > 0 ? 0 : text.length - 1, end = dir > 0 ? text.length : -1; pos != end; pos += dir) {
			let found = brackets.indexOf(text[pos]);
			if (found < 0 || tree.resolveInner(basePos + pos, 1).type != tokenType) continue;
			if (found % 2 == 0 == dir > 0) depth++;
			else if (depth == 1) return {
				start: startToken,
				end: {
					from: basePos + pos,
					to: basePos + pos + 1
				},
				matched: found >> 1 == bracket >> 1
			};
			else depth--;
		}
		if (dir > 0) distance += text.length;
	}
	return iter.done ? {
		start: startToken,
		matched: false
	} : null;
}
function countCol(string, end, tabSize, startIndex = 0, startValue = 0) {
	if (end == null) {
		end = string.search(/[^\s\u00a0]/);
		if (end == -1) end = string.length;
	}
	let n = startValue;
	for (let i = startIndex; i < end; i++) if (string.charCodeAt(i) == 9) n += tabSize - n % tabSize;
	else n++;
	return n;
}
/**
Encapsulates a single line of input. Given to stream syntax code,
which uses it to tokenize the content.
*/
var StringStream = class {
	/**
	Create a stream.
	*/
	constructor(string, tabSize, indentUnit, overrideIndent) {
		this.string = string;
		this.tabSize = tabSize;
		this.indentUnit = indentUnit;
		this.overrideIndent = overrideIndent;
		/**
		The current position on the line.
		*/
		this.pos = 0;
		/**
		The start position of the current token.
		*/
		this.start = 0;
		this.lastColumnPos = 0;
		this.lastColumnValue = 0;
	}
	/**
	True if we are at the end of the line.
	*/
	eol() {
		return this.pos >= this.string.length;
	}
	/**
	True if we are at the start of the line.
	*/
	sol() {
		return this.pos == 0;
	}
	/**
	Get the next code unit after the current position, or undefined
	if we're at the end of the line.
	*/
	peek() {
		return this.string.charAt(this.pos) || void 0;
	}
	/**
	Read the next code unit and advance `this.pos`.
	*/
	next() {
		if (this.pos < this.string.length) return this.string.charAt(this.pos++);
	}
	/**
	Match the next character against the given string, regular
	expression, or predicate. Consume and return it if it matches.
	*/
	eat(match) {
		let ch = this.string.charAt(this.pos);
		let ok;
		if (typeof match == "string") ok = ch == match;
		else ok = ch && (match instanceof RegExp ? match.test(ch) : match(ch));
		if (ok) {
			++this.pos;
			return ch;
		}
	}
	/**
	Continue matching characters that match the given string,
	regular expression, or predicate function. Return true if any
	characters were consumed.
	*/
	eatWhile(match) {
		let start = this.pos;
		while (this.eat(match));
		return this.pos > start;
	}
	/**
	Consume whitespace ahead of `this.pos`. Return true if any was
	found.
	*/
	eatSpace() {
		let start = this.pos;
		while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) ++this.pos;
		return this.pos > start;
	}
	/**
	Move to the end of the line.
	*/
	skipToEnd() {
		this.pos = this.string.length;
	}
	/**
	Move to directly before the given character, if found on the
	current line.
	*/
	skipTo(ch) {
		let found = this.string.indexOf(ch, this.pos);
		if (found > -1) {
			this.pos = found;
			return true;
		}
	}
	/**
	Move back `n` characters.
	*/
	backUp(n) {
		this.pos -= n;
	}
	/**
	Get the column position at `this.pos`.
	*/
	column() {
		if (this.lastColumnPos < this.start) {
			this.lastColumnValue = countCol(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue);
			this.lastColumnPos = this.start;
		}
		return this.lastColumnValue;
	}
	/**
	Get the indentation column of the current line.
	*/
	indentation() {
		var _a;
		return (_a = this.overrideIndent) !== null && _a !== void 0 ? _a : countCol(this.string, null, this.tabSize);
	}
	/**
	Match the input against the given string or regular expression
	(which should start with a `^`). Return true or the regexp match
	if it matches.
	
	Unless `consume` is set to `false`, this will move `this.pos`
	past the matched text.
	
	When matching a string `caseInsensitive` can be set to true to
	make the match case-insensitive.
	*/
	match(pattern, consume, caseInsensitive) {
		if (typeof pattern == "string") {
			let cased = (str) => caseInsensitive ? str.toLowerCase() : str;
			if (cased(this.string.substr(this.pos, pattern.length)) == cased(pattern)) {
				if (consume !== false) this.pos += pattern.length;
				return true;
			} else return null;
		} else {
			let match = this.string.slice(this.pos).match(pattern);
			if (match && match.index > 0) return null;
			if (match && consume !== false) this.pos += match[0].length;
			return match;
		}
	}
	/**
	Get the current token.
	*/
	current() {
		return this.string.slice(this.start, this.pos);
	}
};
function fullParser(spec) {
	return {
		name: spec.name || "",
		token: spec.token,
		blankLine: spec.blankLine || (() => {}),
		startState: spec.startState || (() => true),
		copyState: spec.copyState || defaultCopyState,
		indent: spec.indent || (() => null),
		languageData: spec.languageData || {},
		tokenTable: spec.tokenTable || noTokens,
		mergeTokens: spec.mergeTokens !== false
	};
}
function defaultCopyState(state) {
	if (typeof state != "object") return state;
	let newState = {};
	for (let prop in state) {
		let val = state[prop];
		newState[prop] = val instanceof Array ? val.slice() : val;
	}
	return newState;
}
var IndentedFrom = /* @__PURE__ */ new WeakMap();
/**
A [language](https://codemirror.net/6/docs/ref/#language.Language) class based on a CodeMirror
5-style [streaming parser](https://codemirror.net/6/docs/ref/#language.StreamParser).
*/
var StreamLanguage = class StreamLanguage extends Language {
	constructor(parser) {
		let data = defineLanguageFacet(parser.languageData);
		let p = fullParser(parser), self;
		let impl = new class extends Parser {
			createParse(input, fragments, ranges) {
				return new Parse(self, input, fragments, ranges);
			}
		}();
		super(data, impl, [], parser.name);
		this.topNode = docID(data, this);
		self = this;
		this.streamParser = p;
		this.stateAfter = new NodeProp({ perNode: true });
		this.tokenTable = parser.tokenTable ? new TokenTable(p.tokenTable) : defaultTokenTable;
	}
	/**
	Define a stream language.
	*/
	static define(spec) {
		return new StreamLanguage(spec);
	}
	/**
	@internal
	*/
	getIndent(cx) {
		let from = void 0;
		let { overrideIndentation } = cx.options;
		if (overrideIndentation) {
			from = IndentedFrom.get(cx.state);
			if (from != null && from < cx.pos - 1e4) from = void 0;
		}
		let start = findState(this, cx.node.tree, cx.node.from, cx.node.from, from !== null && from !== void 0 ? from : cx.pos), statePos, state;
		if (start) {
			state = start.state;
			statePos = start.pos + 1;
		} else {
			state = this.streamParser.startState(cx.unit);
			statePos = cx.node.from;
		}
		if (cx.pos - statePos > 1e4) return null;
		while (statePos < cx.pos) {
			let line = cx.state.doc.lineAt(statePos), end = Math.min(cx.pos, line.to);
			if (line.length) {
				let indentation = overrideIndentation ? overrideIndentation(line.from) : -1;
				let stream = new StringStream(line.text, cx.state.tabSize, cx.unit, indentation < 0 ? void 0 : indentation);
				while (stream.pos < end - line.from) readToken(this.streamParser.token, stream, state);
			} else this.streamParser.blankLine(state, cx.unit);
			if (end == cx.pos) break;
			statePos = line.to + 1;
		}
		let line = cx.lineAt(cx.pos);
		if (overrideIndentation && from == null) IndentedFrom.set(cx.state, line.from);
		return this.streamParser.indent(state, /^\s*(.*)/.exec(line.text)[1], cx);
	}
	get allowsNesting() {
		return false;
	}
};
function findState(lang, tree, off, startPos, before) {
	let state = off >= startPos && off + tree.length <= before && tree.prop(lang.stateAfter);
	if (state) return {
		state: lang.streamParser.copyState(state),
		pos: off + tree.length
	};
	for (let i = tree.children.length - 1; i >= 0; i--) {
		let child = tree.children[i], pos = off + tree.positions[i];
		let found = child instanceof Tree && pos < before && findState(lang, child, pos, startPos, before);
		if (found) return found;
	}
	return null;
}
function cutTree(lang, tree, from, to, inside) {
	if (inside && from <= 0 && to >= tree.length) return tree;
	if (!inside && from == 0 && tree.type == lang.topNode) inside = true;
	for (let i = tree.children.length - 1; i >= 0; i--) {
		let pos = tree.positions[i], child = tree.children[i], inner;
		if (pos < to && child instanceof Tree) {
			if (!(inner = cutTree(lang, child, from - pos, to - pos, inside))) break;
			return !inside ? inner : new Tree(tree.type, tree.children.slice(0, i).concat(inner), tree.positions.slice(0, i + 1), pos + inner.length);
		}
	}
	return null;
}
function findStartInFragments(lang, fragments, startPos, endPos, editorState) {
	for (let f of fragments) {
		let from = f.from + (f.openStart ? 25 : 0), to = f.to - (f.openEnd ? 25 : 0);
		let found = from <= startPos && to > startPos && findState(lang, f.tree, 0 - f.offset, startPos, to), tree;
		if (found && found.pos <= endPos && (tree = cutTree(lang, f.tree, startPos + f.offset, found.pos + f.offset, false))) return {
			state: found.state,
			tree
		};
	}
	return {
		state: lang.streamParser.startState(editorState ? getIndentUnit(editorState) : 4),
		tree: Tree.empty
	};
}
var Parse = class {
	constructor(lang, input, fragments, ranges) {
		this.lang = lang;
		this.input = input;
		this.fragments = fragments;
		this.ranges = ranges;
		this.stoppedAt = null;
		this.chunks = [];
		this.chunkPos = [];
		this.chunk = [];
		this.chunkReused = void 0;
		this.rangeIndex = 0;
		this.to = ranges[ranges.length - 1].to;
		let context = ParseContext.get(), from = ranges[0].from;
		let { state, tree } = findStartInFragments(lang, fragments, from, this.to, context === null || context === void 0 ? void 0 : context.state);
		this.state = state;
		this.parsedPos = this.chunkStart = from + tree.length;
		for (let i = 0; i < tree.children.length; i++) {
			this.chunks.push(tree.children[i]);
			this.chunkPos.push(tree.positions[i]);
		}
		if (context && this.parsedPos < context.viewport.from - 1e5 && ranges.some((r) => r.from <= context.viewport.from && r.to >= context.viewport.from)) {
			this.state = this.lang.streamParser.startState(getIndentUnit(context.state));
			context.skipUntilInView(this.parsedPos, context.viewport.from);
			this.parsedPos = context.viewport.from;
		}
		this.moveRangeIndex();
	}
	advance() {
		let context = ParseContext.get();
		let parseEnd = this.stoppedAt == null ? this.to : Math.min(this.to, this.stoppedAt);
		let end = Math.min(parseEnd, this.chunkStart + 512);
		if (context) end = Math.min(end, context.viewport.to);
		while (this.parsedPos < end) this.parseLine(context);
		if (this.chunkStart < this.parsedPos) this.finishChunk();
		if (this.parsedPos >= parseEnd) return this.finish();
		if (context && this.parsedPos >= context.viewport.to) {
			context.skipUntilInView(this.parsedPos, parseEnd);
			return this.finish();
		}
		return null;
	}
	stopAt(pos) {
		this.stoppedAt = pos;
	}
	lineAfter(pos) {
		let chunk = this.input.chunk(pos);
		if (!this.input.lineChunks) {
			let eol = chunk.indexOf("\n");
			if (eol > -1) chunk = chunk.slice(0, eol);
		} else if (chunk == "\n") chunk = "";
		return pos + chunk.length <= this.to ? chunk : chunk.slice(0, this.to - pos);
	}
	nextLine() {
		let from = this.parsedPos, line = this.lineAfter(from), end = from + line.length;
		for (let index = this.rangeIndex;;) {
			let rangeEnd = this.ranges[index].to;
			if (rangeEnd >= end) break;
			line = line.slice(0, rangeEnd - (end - line.length));
			index++;
			if (index == this.ranges.length) break;
			let rangeStart = this.ranges[index].from;
			let after = this.lineAfter(rangeStart);
			line += after;
			end = rangeStart + after.length;
		}
		return {
			line,
			end
		};
	}
	skipGapsTo(pos, offset, side) {
		for (;;) {
			let end = this.ranges[this.rangeIndex].to, offPos = pos + offset;
			if (side > 0 ? end > offPos : end >= offPos) break;
			let start = this.ranges[++this.rangeIndex].from;
			offset += start - end;
		}
		return offset;
	}
	moveRangeIndex() {
		while (this.ranges[this.rangeIndex].to < this.parsedPos) this.rangeIndex++;
	}
	emitToken(id, from, to, offset) {
		let size = 4;
		if (this.ranges.length > 1) {
			offset = this.skipGapsTo(from, offset, 1);
			from += offset;
			let len0 = this.chunk.length;
			offset = this.skipGapsTo(to, offset, -1);
			to += offset;
			size += this.chunk.length - len0;
		}
		let last = this.chunk.length - 4;
		if (this.lang.streamParser.mergeTokens && size == 4 && last >= 0 && this.chunk[last] == id && this.chunk[last + 2] == from) this.chunk[last + 2] = to;
		else this.chunk.push(id, from, to, size);
		return offset;
	}
	parseLine(context) {
		let { line, end } = this.nextLine(), offset = 0, { streamParser } = this.lang;
		let stream = new StringStream(line, context ? context.state.tabSize : 4, context ? getIndentUnit(context.state) : 2);
		if (stream.eol()) streamParser.blankLine(this.state, stream.indentUnit);
		else while (!stream.eol()) {
			let token = readToken(streamParser.token, stream, this.state);
			if (token) offset = this.emitToken(this.lang.tokenTable.resolve(token), this.parsedPos + stream.start, this.parsedPos + stream.pos, offset);
			if (stream.start > 1e4) break;
		}
		this.parsedPos = end;
		this.moveRangeIndex();
		if (this.parsedPos < this.to) this.parsedPos++;
	}
	finishChunk() {
		let tree = Tree.build({
			buffer: this.chunk,
			start: this.chunkStart,
			length: this.parsedPos - this.chunkStart,
			nodeSet,
			topID: 0,
			maxBufferLength: 512,
			reused: this.chunkReused
		});
		tree = new Tree(tree.type, tree.children, tree.positions, tree.length, [[this.lang.stateAfter, this.lang.streamParser.copyState(this.state)]]);
		this.chunks.push(tree);
		this.chunkPos.push(this.chunkStart - this.ranges[0].from);
		this.chunk = [];
		this.chunkReused = void 0;
		this.chunkStart = this.parsedPos;
	}
	finish() {
		return new Tree(this.lang.topNode, this.chunks, this.chunkPos, this.parsedPos - this.ranges[0].from).balance();
	}
};
function readToken(token, stream, state) {
	stream.start = stream.pos;
	for (let i = 0; i < 10; i++) {
		let result = token(stream, state);
		if (stream.pos > stream.start) return result;
	}
	throw new Error("Stream parser failed to advance stream.");
}
var noTokens = /* @__PURE__ */ Object.create(null);
var typeArray = [NodeType.none];
var nodeSet = /* @__PURE__ */ new NodeSet(typeArray);
var warned = [];
var byTag = /* @__PURE__ */ Object.create(null);
var defaultTable = /* @__PURE__ */ Object.create(null);
for (let [legacyName, name] of [
	["variable", "variableName"],
	["variable-2", "variableName.special"],
	["string-2", "string.special"],
	["def", "variableName.definition"],
	["tag", "tagName"],
	["attribute", "attributeName"],
	["type", "typeName"],
	["builtin", "variableName.standard"],
	["qualifier", "modifier"],
	["error", "invalid"],
	["header", "heading"],
	["property", "propertyName"]
]) defaultTable[legacyName] = /* @__PURE__ */ createTokenType(noTokens, name);
var TokenTable = class {
	constructor(extra) {
		this.extra = extra;
		this.table = Object.assign(Object.create(null), defaultTable);
	}
	resolve(tag) {
		return !tag ? 0 : this.table[tag] || (this.table[tag] = createTokenType(this.extra, tag));
	}
};
var defaultTokenTable = /* @__PURE__ */ new TokenTable(noTokens);
function warnForPart(part, msg) {
	if (warned.indexOf(part) > -1) return;
	warned.push(part);
	console.warn(msg);
}
function createTokenType(extra, tagStr) {
	let tags$1 = [];
	for (let name of tagStr.split(" ")) {
		let found = [];
		for (let part of name.split(".")) {
			let value = extra[part] || tags[part];
			if (!value) warnForPart(part, `Unknown highlighting tag ${part}`);
			else if (typeof value == "function") if (!found.length) warnForPart(part, `Modifier ${part} used at start of tag`);
			else found = found.map(value);
			else if (found.length) warnForPart(part, `Tag ${part} used as modifier`);
			else found = Array.isArray(value) ? value : [value];
		}
		for (let tag of found) tags$1.push(tag);
	}
	if (!tags$1.length) return 0;
	let name = tagStr.replace(/ /g, "_"), key = name + " " + tags$1.map((t) => t.id);
	let known = byTag[key];
	if (known) return known.id;
	let type = byTag[key] = NodeType.define({
		id: typeArray.length,
		name,
		props: [styleTags({ [name]: tags$1 })]
	});
	typeArray.push(type);
	return type.id;
}
function docID(data, lang) {
	let type = NodeType.define({
		id: typeArray.length,
		name: "Document",
		props: [languageDataProp.add(() => data), indentNodeProp.add(() => (cx) => lang.getIndent(cx))],
		top: true
	});
	typeArray.push(type);
	return type;
}
function buildForLine(line) {
	return line.length <= 4096 && /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac\ufb50-\ufdff]/.test(line);
}
function textHasRTL(text) {
	for (let i = text.iter(); !i.next().done;) if (buildForLine(i.value)) return true;
	return false;
}
function changeAddsRTL(change) {
	let added = false;
	change.iterChanges((fA, tA, fB, tB, ins) => {
		if (!added && textHasRTL(ins)) added = true;
	});
	return added;
}
var alwaysIsolate = /* @__PURE__ */ Facet.define({ combine: (values) => values.some((x) => x) });
/**
Make sure nodes
[marked](https://lezer.codemirror.net/docs/ref/#common.NodeProp^isolate)
as isolating for bidirectional text are rendered in a way that
isolates them from the surrounding text.
*/
function bidiIsolates(options = {}) {
	let extensions = [isolateMarks];
	if (options.alwaysIsolate) extensions.push(alwaysIsolate.of(true));
	return extensions;
}
var isolateMarks = /* @__PURE__ */ ViewPlugin.fromClass(class {
	constructor(view) {
		this.always = view.state.facet(alwaysIsolate) || view.textDirection != Direction.LTR || view.state.facet(EditorView.perLineTextDirection);
		this.hasRTL = !this.always && textHasRTL(view.state.doc);
		this.tree = syntaxTree(view.state);
		this.decorations = this.always || this.hasRTL ? buildDeco(view, this.tree, this.always) : Decoration.none;
	}
	update(update) {
		let always = update.state.facet(alwaysIsolate) || update.view.textDirection != Direction.LTR || update.state.facet(EditorView.perLineTextDirection);
		if (!always && !this.hasRTL && changeAddsRTL(update.changes)) this.hasRTL = true;
		if (!always && !this.hasRTL) return;
		let tree = syntaxTree(update.state);
		if (always != this.always || tree != this.tree || update.docChanged || update.viewportChanged) {
			this.tree = tree;
			this.always = always;
			this.decorations = buildDeco(update.view, tree, always);
		}
	}
}, { provide: (plugin) => {
	function access(view) {
		var _a, _b;
		return (_b = (_a = view.plugin(plugin)) === null || _a === void 0 ? void 0 : _a.decorations) !== null && _b !== void 0 ? _b : Decoration.none;
	}
	return [EditorView.outerDecorations.of(access), Prec.lowest(EditorView.bidiIsolatedRanges.of(access))];
} });
function buildDeco(view, tree, always) {
	let deco = new RangeSetBuilder();
	let ranges = view.visibleRanges;
	if (!always) ranges = clipRTLLines(ranges, view.state.doc);
	for (let { from, to } of ranges) tree.iterate({
		enter: (node) => {
			let iso = node.type.prop(NodeProp.isolate);
			if (iso) deco.add(node.from, node.to, marks[iso]);
		},
		from,
		to
	});
	return deco.finish();
}
function clipRTLLines(ranges, doc) {
	let cur = doc.iter(), pos = 0, result = [], last = null;
	for (let { from, to } of ranges) {
		if (last && last.to > from) {
			from = last.to;
			if (from >= to) continue;
		}
		if (pos + cur.value.length < from) {
			cur.next(from - (pos + cur.value.length));
			pos = from;
		}
		for (;;) {
			let start = pos, end = pos + cur.value.length;
			if (!cur.lineBreak && buildForLine(cur.value)) if (last && last.to > start - 10) last.to = Math.min(to, end);
			else result.push(last = {
				from: start,
				to: Math.min(to, end)
			});
			if (end >= to) break;
			pos = end;
			cur.next();
		}
	}
	return result;
}
var marks = {
	rtl: /* @__PURE__ */ Decoration.mark({
		class: "cm-iso",
		inclusive: true,
		attributes: { dir: "rtl" },
		bidiIsolate: Direction.RTL
	}),
	ltr: /* @__PURE__ */ Decoration.mark({
		class: "cm-iso",
		inclusive: true,
		attributes: { dir: "ltr" },
		bidiIsolate: Direction.LTR
	}),
	auto: /* @__PURE__ */ Decoration.mark({
		class: "cm-iso",
		inclusive: true,
		attributes: { dir: "auto" },
		bidiIsolate: null
	})
};
//#endregion
export { unfoldCode as $, foldState as A, indentService as B, foldCode as C, foldKeymap as D, foldInside as E, getIndentation as F, matchBrackets as G, indentUnit as H, highlightingFor as I, syntaxParserRunning as J, sublanguageProp as K, indentNodeProp as L, foldedRanges as M, forceParsing as N, foldNodeProp as O, getIndentUnit as P, unfoldAll as Q, indentOnInput as R, foldAll as S, foldGutter as T, language as U, indentString as V, languageDataProp as W, syntaxTreeAvailable as X, syntaxTree as Y, toggleFold as Z, defaultHighlightStyle as _, Language as a, NodeProp as at, ensureSyntaxTree as b, ParseContext as c, NodeWeakMap as ct, TreeIndentContext as d, parseMixed as dt, unfoldEffect as et, bidiIsolates as f, continuedIndent as g, codeFolding as h, LRLanguage as i, IterMode as it, foldable as j, foldService as k, StreamLanguage as l, Parser as lt, bracketMatchingHandle as m, HighlightStyle as n, tags as nt, LanguageDescription as o, NodeSet as ot, bracketMatching as p, syntaxHighlighting as q, IndentContext as r, DefaultBufferLength as rt, LanguageSupport as s, NodeType as st, DocInput as t, styleTags as tt, StringStream as u, Tree as ut, defineLanguageFacet as v, foldEffect as w, flatIndent as x, delimitedIndent as y, indentRange as z };

//# sourceMappingURL=dist-CamJ8SlV.js.map