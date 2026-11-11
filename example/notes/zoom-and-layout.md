# Zoom and layout

Zoom is limited to a range, and Fit picks a zoom that shows the whole canvas.

The graph allows zoom values between 0.2 and 2. With a canvas of width $w$ and height $h$ in a view of size $W \times H$, and a small padding $p$ around it, a fit zoom is roughly

$$z = \min\left(\frac{W}{w\,(1+2p)},\ \frac{H}{h\,(1+2p)}\right)$$

and the result is kept between the limits, so $z \in [0.2, 2]$. The page uses $p = 0.05$.

Groups are drawn behind cards, and edges can end at a group as well as at a card. See [[graph]].
