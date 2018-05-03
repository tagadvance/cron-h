$(document).ready(
		function() {
			var onUpdate = function() {
				var text = $(this).val();
				var range = $(this).caret();
				var caret = range.start;
				var row = getSelectedRow(text, caret);

				var matches = row.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/);
				if (matches) {
					$.get("cron.php", {
						'cron' : row,
						'format' : "F d, Y h:i A"
					}, function(data) {
						$('#human-readable').text(data['human_readable']);
						$('#next').text(
								'Next Run Date: ' + data['next_run_date']);
					});

					updateCP(matches[1], matches[2], matches[3], matches[4], matches[5]);
				} else {
					$('#human-readable').text('parse error');
					$('#next').text('Next run at ???');
				}

			};
			$('#crontab').mouseup(onUpdate).keyup(onUpdate);
		});