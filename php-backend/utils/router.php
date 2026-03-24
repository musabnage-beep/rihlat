<?php

class Router {
    private array $routes = [];
    private string $groupPrefix = '';

    /**
     * Set a group prefix for routes.
     */
    public function group(string $prefix, callable $callback): void {
        $previousPrefix = $this->groupPrefix;
        $this->groupPrefix .= $prefix;
        $callback($this);
        $this->groupPrefix = $previousPrefix;
    }

    public function get(string $path, callable $handler): void {
        $this->addRoute('GET', $path, $handler);
    }

    public function post(string $path, callable $handler): void {
        $this->addRoute('POST', $path, $handler);
    }

    public function put(string $path, callable $handler): void {
        $this->addRoute('PUT', $path, $handler);
    }

    public function patch(string $path, callable $handler): void {
        $this->addRoute('PATCH', $path, $handler);
    }

    public function delete(string $path, callable $handler): void {
        $this->addRoute('DELETE', $path, $handler);
    }

    public function addRoute(string $method, string $path, callable $handler): void {
        $fullPath = $this->groupPrefix . $path;
        $this->routes[] = [
            'method'  => $method,
            'path'    => $fullPath,
            'handler' => $handler,
        ];
    }

    /**
     * Dispatch the current request to matching route.
     */
    public function dispatch(): void {
        $method = $_SERVER['REQUEST_METHOD'];
        $uri = $_SERVER['REQUEST_URI'];

        // Strip query string
        if (($pos = strpos($uri, '?')) !== false) {
            $uri = substr($uri, 0, $pos);
        }

        // Remove /api prefix
        $uri = preg_replace('#^/api#', '', $uri);
        $uri = '/' . trim($uri, '/');
        if ($uri === '/') {
            $uri = '/';
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            $pattern = $this->pathToRegex($route['path']);
            if (preg_match($pattern, $uri, $matches)) {
                // Extract named parameters
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                try {
                    ($route['handler'])($params);
                } catch (\Exception $e) {
                    jsonError($e->getMessage(), 500);
                }
                return;
            }
        }

        jsonError('Route not found', 404);
    }

    /**
     * Convert a route path with {param} placeholders to a regex.
     */
    private function pathToRegex(string $path): string {
        $path = '/' . trim($path, '/');
        // Replace {param} with named capture group
        $pattern = preg_replace('#\{([a-zA-Z_]+)\}#', '(?P<$1>[^/]+)', $path);
        return '#^' . $pattern . '$#';
    }
}
