(function() {

jQuery.extend({
    postJSON: function(url, data, callback) {
        return jQuery.ajax({
            type: 'POST',
            url: url,
            data: JSON.stringify(data),
            success: callback,
            dataType: 'text',
            contentType: 'application/json',
            processData: false
        });
    }
});

$(document).ajaxStart(function() {
    $('.refresh.loader').show();
    $('input, button, select').attr('disabled', true);
});
$(document).ajaxStop(function() {
    $('.refresh.loader').hide();
    $('.loader').removeClass('loader');
    $('input, button, select').attr('disabled', false);
});

function sync() {
    $.get('/sync/');
    setTimeout(sync, 30000);
}
sync();

$('.panel').on('loader', function(event, element) {
    var panel = $(event.target);
    panel.find('.refresh').addClass('loader');
    if (element) {
        $(element).addClass('loader');
    }
});
$('.panel').on('panel_get', function(event, data) {
    var panel = $(event.target);
    var panel_id = panel.attr('id');
    var refresh = function() {
        panel.trigger('panel_get');
    };
    var storage = Storage(panel_id);

    if (window.location.hash == '#reset') {
        storage.reset();
    }

    var url = data && data.url || storage.get('url');
    url = url ? url : panel.data('box');
    if (!(url.indexOf('/emails/') === 0 || url.indexOf('/gm-thread/') === 0)) {
        return;
    }
    var hash = window.location.hash.slice(1);
    var new_hash = [panel_id, url].join('');
    var prev_url = storage.get('url');
    prev_url = [panel_id, prev_url].join('');
    if (hash != prev_url && hash != new_hash) {
        window.location.hash = prev_url;
    }

    panel.trigger('loader');
    $.get(url, function(content) {
        if (url != storage.get('url')) {
            storage.set('url', url);
            storage.set('uids', []); // Reset picked uids
            window.location.hash = new_hash;
        }
        if (url.indexOf('/emails/') === 0) {
            storage.set('label', url);
        }
        if (url.indexOf('?q=') === -1) {
            storage.set('q', null);
        }
        var label_id = storage.get('label');
        label_id = label_id && parseInt(label_id.split('=')[1]);
        var mark = function(name, ids, use_threads, callback) {
            $.postJSON('/mark/' + name + '/', {ids: ids, use_threads: use_threads})
                .done(callback || refresh);
        };

        // Set content
        panel.html(content);

        panel.find('.labels [value="' + url + '"]').prop('selected', true);
        panel.find('.panel-head')
            .find('.labels').on('change', function() {
                panel.trigger('panel_get', {url: $(this).find(':selected').val()});
            });

        panel.find('.email-line .email-info').click(function() {
            if (!$(this).parents('.thread').length) {
                panel.trigger('panel_get', {url: $(this).parents('.email').data('thread')});
            }
            return false;
        });

        panel.find('.email-pick input')
            .each(function() {
                var uid = $(this).val();
                if (storage.get('uids').indexOf(uid) > -1) {
                    $(this).attr('checked', true);
                } else if ($(this).is(':checked')) {
                    storage.addChild('uids', uid);
                }
            })
            .on('change', function() {
                var uid = $(this).val();
                if ($(this).is(':checked') && storage.get('uids').indexOf(uid) == -1) {
                    storage.addChild('uids', uid);
                } else {
                    storage.delChild('uids', uid);
                }
                panel.trigger('refresh_buttons');
            });
        panel.find('.email-star').click(function() {
            panel.trigger('loader');
            var $this = $(this);
            var name = $this.hasClass('email-starred') ? 'unstarred': 'starred';
            mark(name, [$this.parents('.email').data('id')]);
        });

        panel.find('.email-labels a, .email-filter').click(function() {
            panel.trigger('panel_get', {url: $(this).attr('href')});
            return false;
        });

        if (panel.find('.thread').length) {
            panel.find('.email-info').click(function() {
                $(this).parents('.email').toggleClass('email-showed');
            });
            panel.find('.email-group-show').click(function() {
                $(this).hide().next('.email-group').show();
            });

            panel.find('.email-quote-switch').click(function() {
                $(this).next('.email-quote').toggle();
            });
        }

        panel.on('refresh_buttons', function() {
            var buttons = panel.find('button');
            var checked = panel.find('.email-pick input:checked').parents('.email');
            var in_trash = panel.find('.email').data('labels');
            in_trash = in_trash &&  in_trash.indexOf(CONF.trash_id) != -1;

            buttons.hide();
            panel.find('.inputs button').show();
            if (storage.get('q') !== null) {
                panel.find('.inputs').addClass('search-on');
                panel.find('[name="q"]').val(storage.get('q'));
            }
            if (checked.length > 0) {
                buttons.filter('[value="inboxed"]').show();
                buttons.filter('[value="archived"]').show();
                if (!in_trash) {
                    buttons.filter('[value="deleted"]').show();
                }
            }
            if (checked.filter('.email-unread').length > 0) {
                buttons.filter('[value="read"]').show();
            }
            if (checked.not('.email-unread').length > 0) {
                buttons.filter('[value="unread"]').show();
            }
            if (checked.find('.email-star:not(.email-starred)').length > 0) {
                buttons.filter('[value="starred"]').show();
            }
            if (checked.find('.email-starred').length > 0) {
                buttons.filter('[value="unstarred"]').show();
            }
        }).trigger('refresh_buttons');

        panel.find('button[name="search"]').click(function() {
            $(this).parents('.inputs').toggleClass('search-on');
            return false;
        });
        panel.find('.search-query').submit(function() {
            panel.trigger('loader', panel.find('.search-go'));
            var query = panel.find('[name="q"]').val();
            if (query) {
                storage.set('q', query);
                panel.trigger('panel_get', {url: '/emails/?q=' + query});
            }
            return false;
        });
        panel.find('button[name="mark"]').click(function() {
            panel.trigger('loader', this);
            var $this = $(this);
            var callback = refresh;
            var use_threads = panel.find('thread').length === 0;
            if ($this.val() == 'deleted' || ($this.val() == 'archived' && label_id == CONF.inbox_id)) {
                callback = function() {
                    panel.trigger('panel_get', {url: storage.get('label')});
                };
            }
            mark($this.val(), storage.get('uids'), use_threads, callback);
            return false;
        });
        panel.find('button[name="refresh"]').click(function() {
            panel.trigger('loader', this);
            $.get('/sync/');
            refresh();
            return false;
        });
        panel.find('.email-show a').click(function() {
            var $this = $(this);
            var parent = $this.parents('.email-show');
            var count = parent.data('count');
            if ($this.hasClass('show-all')) {
                panel.find('.email-hide').removeClass('email-hide');
                parent.hide();
            }
            if ($this.hasClass('show-next')) {
                panel.find('.email-hide').slice(0, count).removeClass('email-hide');
                if (!panel.find('.email-hide').length) {
                    parent.hide();
                } else if (panel.find('.email-hide').length <= count) {
                    $this.hide();
                }
            }
        });
    });
});

$('body').on('refresh', function() {
    $('.panel:visible').each(function() {
        $(this).trigger('panel_get');
    });
});

$.get('init', {'offset': new Date().getTimezoneOffset() / 60}).done(function() {
    $('body').trigger('refresh');
});

$(window).on('hashchange', function(event) {
    if (window.location.hash == '#reset') {
        $('.opts').trigger('reset');
        return;
    }
    var parts = window.location.hash.split('/');
    var panel = $(parts.shift());
    var url = '/' + parts.join('/');
    var storage = Storage(panel.attr('id'));
    if (panel.length && storage.get('url') != url) {
        panel.trigger('panel_get', {url: url});
    }
});

function settings() {
    var defaults = {
        two_panels: true,
        fluid: false,
        font_size: 'normal'
    };
    var storage = Storage('opts');
    var opts = $.extend(defaults, storage.get('opts') || {});
    var block = $('.opts');
    block.find('.opt-two_panels')
        .on('change', function() {
            opts.two_panels = !opts.two_panels;
            block.trigger('refresh');
        });
    block.find('.opt-fluid')
        .on('change', function() {
            opts.fluid = !opts.fluid;
            block.trigger('refresh');
        });
    block.find('.opt-font')
        .on('change', function() {
            opts.font_size = $(this).val();
            block.trigger('refresh');
        });

    block
        .on('init', function() {
            if (opts.closed) {
                block.hide();
            }
            block.find('.opt-two_panels').prop('checked', opts.two_panels);
            block.find('.opt-fluid').prop('checked', opts.fluid);
            block.find('.opt-font')
                .filter('[value="' + opts.font_size + '"]').prop('checked', true);
        })
        .trigger('init')
        .on('refresh', function() {
            var classes = [];
            if (opts.two_panels) {
                classes.push('two-panels');
            }
            if (opts.fluid) {
                classes.push('fluid');
            }
            if (opts.font_size == 'bigger') {
                classes.push('bigger');
            }
            $('body').attr('class', classes.join(' ')).trigger('refresh');
        })
        .trigger('refresh')
        .on('reset', function() {
            opts = defaults;
            storage.set('opts', null);
            block.trigger('init');
        })
        .submit(function() {
            opts.two_panels = block.find('.opt-two_panels').is(':checked');
            opts.fluid = block.find('.opt-fluid').is(':checked');
            opts.font_size = block.find('.opt-font:checked').val();
            $(this).trigger('refresh');
            return false;
        });
    $('.opts-save').click(function() {
        opts.closed = true;
        storage.set('opts', opts);
        block.hide();
    });
    $('body').on('keyup', function(e) {
        if (e.shiftKey && e.which == 191) {
            e.preventDefault();
            block.show();
        }
    });
}
settings();

function Storage(target) {
    var defaults = {url: null, uids: [], label: null, q: null};
    var storage = null;

    var me = {
        loads: function() {
            storage = localStorage[target];
            storage = storage ? JSON.parse(storage) : defaults;
        },
        get: function(key) {
            me.loads(); // FIXME
            return storage[key];
        },
        set: function(key, val) {
            storage[key] = val;
            me.save();
        },
        addChild: function(key, val) {
            storage[key].push(val);
            me.save();
        },
        delChild: function(key, val) {
            var index = storage[key].indexOf(val);
            storage[key].splice(index, 1);
            me.save();
        },
        reset: function() {
            storage = defaults;
            me.save();
            return storage;
        },
        save: function() {
            localStorage[target] = JSON.stringify(storage);
        }
    };
    me.loads();
    return me;
}
// END
})();
