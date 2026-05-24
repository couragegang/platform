const err = $('Parse Step Context').first().json.error || 'Invalid tool step payload';
return [{ json: { action: 'complete', callback: { status: 'error', reply: err } } }];
