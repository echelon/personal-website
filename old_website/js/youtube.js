/**
 * Animate Youtube video thumbnail animations and links
 */
var animateVideos= function()
{
	var div = $('#videos');

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

	$('#videos img').each(function() {
		var id = $(this).attr('id');
		$(this).attr('src', makeUrl(id, 1))
			.data('state', 1)
			.data('id', id)
			.mouseenter(function() {
				var that = this;
				nextFrame(that);
				$(this).addClass('hover')
					.data('interval',
						setInterval(function() {
							nextFrame(that);
						}, 600)
					);
			})
			.mouseleave(function() {
				clearInterval($(this).data('interval'));
				setFrame(this, 1);
				$(this).removeClass('hover');
			});
	});
}

