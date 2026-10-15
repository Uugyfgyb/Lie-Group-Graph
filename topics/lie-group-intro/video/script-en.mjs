// English narration. Same scenes and the same number of lines per scene as script.mjs, so every animation cue keyed to a line still fits.
// say is spoken (no Greek letters or brackets, so the voice does not spell them out); sub is the subtitle and may use symbols. sub defaults to say.
export const scenes = [
  {
    id: "open", seal: "", title: "",
    lines: [
      { say: "Beads into a circle, and the circle from its tangent. Lie groups, in three minutes." },
    ],
  },
  {
    id: "lian", seal: "连", title: "From point groups to the circle",
    lines: [
      { say: "Start with a pinwheel. It has six blades. Turn it sixty degrees, and it looks exactly the same." },
      { say: "Turn it forty-five degrees, and the blades no longer line up. So it has only six symmetry rotations, like six separate beads." },
      { say: "More blades, denser beads." },
      { say: "With infinitely many blades, the pinwheel becomes a disk. Every angle is a symmetry, and the beads join into a whole circle." },
      { say: "A symmetry that can change continuously, and that we can differentiate, is called a Lie group. This circle is the simplest one: the rotation group of the plane, S O 2.", sub: "A symmetry that can change continuously, and that we can differentiate, is called a Lie group. This circle is the simplest one: the rotation group of the plane, SO(2)." },
    ],
  },
  {
    id: "qie", seal: "切", title: "The tangent at the identity",
    lines: [
      { say: "A circle is curved, and curves are hard to compute with. So focus on the point where nothing turns, the identity, and zoom in." },
      { say: "Ten times, a hundred times. The arc gets straighter, until it almost matches this tangent line." },
      { say: "The tangent line records which way you move as you start to turn. It is a vector space, and mathematicians call it the Lie algebra." },
      { say: "For rotations of the plane, that direction is the matrix J. It turns an arrow pointing right into an arrow pointing up." },
    ],
  },
  {
    id: "juan", seal: "卷", title: "The exponential map: winding it back",
    lines: [
      { say: "Now go the other way. How do we get from the tangent line back to the circle? Treat the tangent like a thread, and wind it back onto the circle." },
      { say: "This step is the exponential map, and its formula is the same as for e to the x.", sub: "This step is the exponential map, and its formula is the same as for eˣ." },
      { say: "Lay the terms end to end. The first term walks to the starting point, the second is exactly that tangent segment, and the rest bend it, bit by bit." },
      { say: "It lands right on the circle. That is Euler's formula." },
      { say: "With a different matrix, the exponential map makes the whole plane flow: rotate, shear, squeeze." },
      { say: "As long as the trace of the matrix is zero, the area never changes." },
    ],
  },
  {
    id: "kuo", seal: "括", title: "The Lie bracket: order matters",
    lines: [
      { say: "In three dimensions, the order of rotations starts to matter." },
      { say: "Try this on a sphere: a small step back around y, a small step back around x, then a step forward around y, and a step forward around x." },
      { say: "If rotations commuted, the point would come home. Instead it misses by a little: almost exactly a turn around z by the square of the small angle.", sub: "If rotations commuted, the point would come home. Instead it misses by a little: almost exactly a turn around z by ε²." },
      { say: "That gap is the Lie bracket. The bracket of L x and L y equals L z.", sub: "That gap is the Lie bracket: [Lx, Ly] = Lz." },
      { say: "The angular momentum commutation relations of quantum mechanics say exactly this." },
    ],
  },
  {
    id: "fu", seal: "覆", title: "One Lie algebra, two groups",
    lines: [
      { say: "The same Lie algebra can be wound into another group, S U 2. This is where electron spin lives.", sub: "The same Lie algebra can be wound into another group, SU(2). This is where electron spin lives." },
      { say: "Turn an object a full circle, three hundred sixty degrees, and it is back where it started." },
      { say: "But in S U 2, the phase has gone only halfway, and stops at minus one.", sub: "But in SU(2), the phase has gone only halfway, and stops at −1." },
      { say: "So turning an electron once flips the sign of its wave function. It takes two full turns, seven hundred twenty degrees, to truly come back." },
      { say: "In nineteen seventy-five, two neutron interference experiments measured exactly this sign.", sub: "In 1975, two neutron interference experiments measured exactly this sign." },
    ],
  },
  {
    id: "end", seal: "", title: "",
    lines: [
      { say: "To sum up: the tangent at the identity gives the Lie algebra; the exponential map winds it back into the group; and the Lie bracket records that rotations do not commute." },
      { say: "Beads into a circle, and the circle from its tangent. To play with these pictures yourself, open the interactive page below." },
    ],
  },
];
