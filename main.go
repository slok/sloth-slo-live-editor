//go:build js && wasm
// +build js,wasm

// Steps to run:
// * `GOOS=js GOARCH=wasm go build -o main.wasm ./examples/slothlib/wasm/main.go`
// * `cp $(go env GOROOT)/lib/wasm/wasm_exec.js ./examples/slothlib/wasm/`
// * `python3 -m http.server 8080 -d ./examples/slothlib/wasm/`
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io/fs"
	"syscall/js"
	"testing/fstest"

	sloth "github.com/slok/sloth/pkg/lib"
)

var sloGenerator = func() *sloth.PrometheusSLOGenerator {
	gen, err := sloth.NewPrometheusSLOGenerator(sloth.PrometheusSLOGeneratorConfig{
		ExtraLabels: map[string]string{"source": "wasm-sloth"},
	})
	if err != nil {
		panic(err)
	}
	return gen
}()

func getGenerator(sloPlugin string) (*sloth.PrometheusSLOGenerator, error) {
	if sloPlugin == "" {
		return sloGenerator, nil
	}

	// We need a new generator with the plugin loaded.
	plugFS := make(fstest.MapFS)
	plugFS["plugin.go"] = &fstest.MapFile{Data: []byte(sloPlugin)}
	gen, err := sloth.NewPrometheusSLOGenerator(sloth.PrometheusSLOGeneratorConfig{
		ExtraLabels:   map[string]string{"source": "wasm-sloth"},
		PluginsFS:     []fs.FS{plugFS},
		StrictPlugins: true,
	})
	if err != nil {
		return nil, err
	}

	return gen, nil
}

type sloGenOut struct {
	ResultRendered string                            `json:"resultRendered"`
	Result         sloth.SLOGroupPrometheusStdResult `json:"result"`
}

// generateSLOFromRaw is a JS-exposed function that takes SLO YAML as input and returns generated Prometheus rules or an error message.
func generateSLOFromRaw(this js.Value, args []js.Value) interface{} {
	ctx := context.Background()

	if len(args) < 1 {
		return js.ValueOf("missing SLO YAML input")
	}

	sloSpec := []byte(args[0].String())
	sloPluginSpec := ""
	if len(args) >= 2 {
		sloPluginSpec = args[1].String()
	}
	generator, err := getGenerator(sloPluginSpec)
	if err != nil {
		return js.ValueOf("Error: " + err.Error())
	}

	slo, err := generator.GenerateFromRaw(ctx, sloSpec)
	if err != nil {
		return js.ValueOf("Error: " + err.Error())
	}

	var resultB bytes.Buffer
	switch {
	case slo.SLOGroup.OriginalSource.K8sSlothV1 != nil:
		kmeta := sloth.K8sMeta{
			Name:        slo.SLOGroup.OriginalSource.K8sSlothV1.ObjectMeta.Name,
			Namespace:   slo.SLOGroup.OriginalSource.K8sSlothV1.ObjectMeta.Namespace,
			Labels:      slo.SLOGroup.OriginalSource.K8sSlothV1.Labels,
			Annotations: slo.SLOGroup.OriginalSource.K8sSlothV1.Annotations,
		}
		err := sloth.WriteResultAsK8sPrometheusOperator(ctx, kmeta, *slo, &resultB)
		if err != nil {
			return js.ValueOf("Error: " + err.Error())
		}
	default:
		err := sloth.WriteResultAsPrometheusStd(ctx, *slo, &resultB)
		if err != nil {
			return js.ValueOf("Error: " + err.Error())
		}
	}

	resJSON, err := json.Marshal(sloGenOut{
		ResultRendered: resultB.String(),
		Result:         *slo,
	})

	return js.ValueOf(string(resJSON))
}

func main() {
	js.Global().Set("generateSLOFromRaw", js.FuncOf(generateSLOFromRaw)) // Expose the function to JS.
	select {}                                                            // Keep running
}
