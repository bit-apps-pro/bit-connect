<?php

/**
 * Minimal stand-in for the $wpdb global.
 *
 * Only the two statements the plugin writes by hand are implemented: the
 * targeted UPDATE and DELETE that the query builder cannot run. Those exist
 * because QueryBuilder::update() builds a statement and returns without
 * executing it, and save() on a fetched row emits a mismatched column list —
 * both fail quietly enough that a button appears to work and changes nothing.
 * The stub is what lets a test tell "wrote the row" from "wrote nothing".
 *
 * Rows for the follows table are read from and written to
 * $GLOBALS['__bc_follows'], the same store the Follow double answers from, so a
 * mute made through $wpdb is visible to the next findFor().
 *
 * Every call is also recorded in $GLOBALS['__wpdb_calls'].
 */
class WpdbDouble
{
    public $prefix = 'wp_';

    public $posts = 'wp_posts';

    public $comments = 'wp_comments';

    public $users = 'wp_users';

    /**
     * Set by the Notification double on every insert, which is where deliver()
     * reads the new row's id from — the model's own return says nothing about
     * it.
     *
     * @var int
     */
    public $insert_id = 0;

    /**
     * Set to true to make the next write fail, which is the branch that
     * separates "already in that state" from "could not be written".
     *
     * @var bool
     */
    public $failWrites = false;


    /**
     * Interpolates the placeholders the plugin uses, so a test can read the
     * statement that was built. No escaping beyond quoting — nothing here talks
     * to a database.
     *
     * @param mixed ...$args
     */
    public function prepare($query, ...$args)
    {
        if (\count($args) === 1 && \is_array($args[0])) {
            $args = $args[0];
        }

        foreach ($args as $value) {
            $query = preg_replace(
                '/%[dfs]/',
                \is_int($value) || \is_float($value) ? (string) $value : "'" . $value . "'",
                (string) $query,
                1
            );
        }

        return $query;
    }

    /**
     * Runs the one hand-written statement the plugin issues: the collapse
     * bump. Anything else is recorded and reported as no rows affected.
     *
     * @return false|int
     */
    public function query($query)
    {
        $GLOBALS['__wpdb_calls'][] = ['method' => 'query', 'query' => $query];

        if ($this->failWrites) {
            return false;
        }

        if (!preg_match('/SET event_count = event_count \+ 1.*WHERE id = (\d+)/s', (string) $query, $matches)) {
            return 0;
        }

        $id = (int) $matches[1];
        $affected = 0;

        foreach ($GLOBALS['__bc_notifications'] ?? [] as $index => $row) {
            // read_at IS NULL in the statement: a row read between the select
            // and the update no longer absorbs the event.
            if ((int) ($row['id'] ?? 0) !== $id || ($row['read_at'] ?? null) !== null) {
                continue;
            }

            $GLOBALS['__bc_notifications'][$index]['event_count'] = (int) ($row['event_count'] ?? 1) + 1;
            ++$affected;
        }

        return $affected;
    }

    /**
     * @return null|string
     */
    public function get_var($query)
    {
        $GLOBALS['__wpdb_calls'][] = ['method' => 'get_var', 'query' => $query];

        return $GLOBALS['__wpdb_get_var'] ?? null;
    }

    /**
     * @param array<string, mixed> $data
     * @param array<string, mixed> $where
     * @param null|array<int, string> $format
     * @param null|array<int, string> $whereFormat
     *
     * @return false|int rows affected
     */
    public function update($table, array $data, array $where, $format = null, $whereFormat = null)
    {
        $GLOBALS['__wpdb_calls'][] = ['method' => 'update', 'table' => $table, 'data' => $data, 'where' => $where];

        if ($this->failWrites) {
            return false;
        }

        $store = $this->storeFor($table);
        $affected = 0;

        foreach ($GLOBALS[$store] ?? [] as $index => $row) {
            if (!$this->matches($row, $where)) {
                continue;
            }

            foreach ($data as $column => $value) {
                $GLOBALS[$store][$index][$column] = $value;
            }

            ++$affected;
        }

        return $affected;
    }

    /**
     * @param array<string, mixed> $where
     * @param null|array<int, string> $whereFormat
     *
     * @return false|int rows affected
     */
    public function delete($table, array $where, $whereFormat = null)
    {
        $GLOBALS['__wpdb_calls'][] = ['method' => 'delete', 'table' => $table, 'where' => $where];

        if ($this->failWrites) {
            return false;
        }

        $store = $this->storeFor($table);
        $kept = [];
        $affected = 0;

        foreach ($GLOBALS[$store] ?? [] as $row) {
            if ($this->matches($row, $where)) {
                ++$affected;

                continue;
            }

            $kept[] = $row;
        }

        $GLOBALS[$store] = $kept;

        return $affected;
    }

    /**
     * Which seeded store a table name addresses. Follows is the default so the
     * existing follow tests keep reading the store they always did.
     */
    private function storeFor($table): string
    {
        return str_contains((string) $table, 'reports') ? '__bc_reports' : '__bc_follows';
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, mixed> $where
     */
    private function matches(array $row, array $where): bool
    {
        foreach ($where as $column => $value) {
            if ((string) ($row[$column] ?? '') !== (string) $value) {
                return false;
            }
        }

        return true;
    }
}

$GLOBALS['wpdb'] = new WpdbDouble();
