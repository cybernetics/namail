<select class="labels">
{% for label in labels %}
    <option value="#{{ url_for('label', label=label.id) }}" data-id="{{ label.id }}">
        {{ label.human_name }} <b>{{ label.unread }}</b>/{{ label.exists }}
    </option>
{% endfor %}
</select>