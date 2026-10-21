# Branded classroom visual QA

Actual authenticated Chromium browser screenshots for instructor, learner A and learner B are attached in this evidence folder. Camera frames show synthetic green test streams, not real people.

Fixed two source bugs: raise-hand was disabled after successful connection; mobile LiveKit video stage failed to constrain bottom control bar. At 375 x 812 the final authenticated test verified dock 10px above the stage bottom, 25px separation from the hand-raise control, 10 controls with minimum 44 x 44 hit targets and no horizontal document overflow.

This is Chromium device emulation only. WebKit, physical mobile Safari, keyboard and screenreader accessibility, reduced-motion and instructor screen sharing remain outside this acceptance slice.
