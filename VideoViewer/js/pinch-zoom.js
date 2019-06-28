// widely inspired by https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures

{
	var touchPointers = [];
	var diffStart = -1;
	var zoom_callback = () => {};

	// init
	function init_pinch_zoom(callback) {
		// Install event handlers for the pointer target
		var el = document.getElementById("canvas");; 
		el.onpointerdown = pointerdown_handler;
		el.onpointermove = pointermove_handler;

		// Use same handler for pointer{up,cancel,out,leave} events since the semantics for these events - in this app - are the same.
		el.onpointerup = pointerup_handler;
		el.onpointercancel = pointerup_handler;
		el.onpointerout = pointerup_handler;
		el.onpointerleave = pointerup_handler;
		
		zoom_callback = callback;
	}

	function pointerdown_handler(ev) {
		// The pointerdown event signals the start of a touch interaction. This event is cached to support 2-finger gestures
		touchPointers.push(ev);
	}

	function pointermove_handler(ev) {
		// This function implements a 2-pointer horizontal pinch/zoom gesture. 
		//
		// If the distance between the two pointers has increased (zoom in), 
		// the taget element's background is changed to "pink" and if the 
		// distance is decreasing (zoom out), the color is changed to "lightblue".
		//
		// This function sets the target element's border to "dashed" to visually
		// indicate the pointer's target received a move event.

		// Find this event in the cache and update its record with this event
		for (var i = 0; i < touchPointers.length; i++) {
			if (ev.pointerId == touchPointers[i].pointerId) {
				touchPointers[i] = ev;
				break;
			}
		}

		// If two pointers are down, check for pinch gestures
		if (touchPointers.length == 2) {
			// Calculate the distance between the two pointers
			var dx = Math.abs(touchPointers[0].clientX - touchPointers[1].clientX);
			var dy = Math.abs(touchPointers[0].clientY - touchPointers[1].clientY);
			var curDiff = Math.sqrt(dx*dx + dy*dy);

			if (diffStart > 0) {
				var scale = curDiff / diffStart;
				ev.target.style.transform = "scale(" + scale + ")";
			} else {
				diffStart = curDiff;
			}
		}
	}

	function pointerup_handler(ev) {
		// Remove this pointer from the cache and apply the current scale value
		if(diffStart > 0 && touchPointers.length == 2) {
			var scale = parseFloat(ev.target.style.transform.replace(/[^0-9\.]*/g, ""));  // extract scaling factor
			ev.target.style.width = parseFloat(ev.target.style.width)*scale + "px";
			ev.target.style.transform = "";
			
			zoom_callback();
			

			// If the number of pointers down is less than two then reset diff tracker
			diffStart = -1;
		}
		
		for (var i = 0; i < touchPointers.length; i++) {
			if (touchPointers[i].pointerId == ev.pointerId) {
				touchPointers.splice(i, 1);
				break;
			}
		}
	}
}