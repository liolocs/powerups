package variables

import (
	"testing"
)

func TestParseFlags(t *testing.T) {
	tests := []struct {
		name    string
		flags   []string
		want    map[string]string
		wantErr bool
	}{
		{
			name:  "single variable",
			flags: []string{"key=value"},
			want:  map[string]string{"key": "value"},
		},
		{
			name:  "multiple variables",
			flags: []string{"key1=value1", "key2=value2"},
			want:  map[string]string{"key1": "value1", "key2": "value2"},
		},
		{
			name:    "invalid format",
			flags:   []string{"key"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseFlags(tt.flags)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseFlags() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				for k, v := range tt.want {
					if got[k] != v {
						t.Errorf("ParseFlags() %s = %v, want %v", k, got[k], v)
					}
				}
			}
		})
	}
}

func TestParseNames(t *testing.T) {
	tests := []struct {
		name    string
		flags   []string
		want    []string
		wantErr bool
	}{
		{
			name:  "single name",
			flags: []string{"name"},
			want:  []string{"name"},
		},
		{
			name:  "multiple names",
			flags: []string{"name1", "name2"},
			want:  []string{"name1", "name2"},
		},
		{
			name:    "no names",
			flags:   []string{},
			wantErr: true,
		},
		{
			name:  "deduplicates",
			flags: []string{"name", "name"},
			want:  []string{"name"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseNames(tt.flags)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseNames() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if len(got) != len(tt.want) {
					t.Errorf("ParseNames() length = %d, want %d", len(got), len(tt.want))
					return
				}
				for i, v := range tt.want {
					if got[i] != v {
						t.Errorf("ParseNames()[%d] = %v, want %v", i, got[i], v)
					}
				}
			}
		})
	}
}


