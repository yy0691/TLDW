'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Key, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ApiKey {
  id: string
  provider: 'google' | 'openai'
  api_key_preview: string
  is_active: boolean
  created_at: string
  updated_at: string
}

const PROVIDER_INFO = {
  google: {
    name: 'Google Gemini',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    description: 'Used for video analysis, summaries, and AI chat',
  },
  openai: {
    name: 'OpenAI',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    description: 'Alternative AI provider for video analysis',
  },
}

export default function ApiKeysManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  
  const [selectedProvider, setSelectedProvider] = useState<'google' | 'openai'>('google')
  const [newApiKey, setNewApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    fetchApiKeys()
  }, [])

  const fetchApiKeys = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/api-keys')
      
      if (!response.ok) {
        throw new Error('Failed to fetch API keys')
      }
      
      const data = await response.json()
      setApiKeys(data.apiKeys || [])
    } catch (error) {
      console.error('Error fetching API keys:', error)
      toast.error('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveApiKey = async () => {
    if (!newApiKey.trim()) {
      toast.error('Please enter an API key')
      return
    }
    
    if (newApiKey.length < 10) {
      toast.error('API key seems too short')
      return
    }

    try {
      setSaving(true)
      
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: newApiKey,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save API key')
      }
      
      toast.success(`${PROVIDER_INFO[selectedProvider].name} API key saved successfully!`)
      setNewApiKey('')
      fetchApiKeys()
    } catch (error) {
      console.error('Error saving API key:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save API key')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteApiKey = async (provider: string) => {
    if (!confirm(`Are you sure you want to delete your ${PROVIDER_INFO[provider as keyof typeof PROVIDER_INFO].name} API key?`)) {
      return
    }

    try {
      setDeleting(provider)
      
      const response = await fetch(`/api/user/api-keys?provider=${provider}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete API key')
      }
      
      toast.success('API key deleted successfully')
      fetchApiKeys()
    } catch (error) {
      console.error('Error deleting API key:', error)
      toast.error('Failed to delete API key')
    } finally {
      setDeleting(null)
    }
  }

  const existingKey = apiKeys.find(key => key.provider === selectedProvider)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Key className="h-5 w-5" />
              AI API Keys
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Use your own API keys for AI features. If not set, server keys will be used.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Add/Update API Key Form */}
        <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
          <div className="space-y-2">
            <Label htmlFor="provider">AI Provider</Label>
            <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as 'google' | 'openai')}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Gemini</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{PROVIDER_INFO[selectedProvider].description}</span>
              <a
                href={PROVIDER_INFO[selectedProvider].getKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Get API Key
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder={existingKey ? 'Enter new key to update...' : 'Paste your API key here...'}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {existingKey && (
              <p className="text-xs text-muted-foreground">
                Current key: {existingKey.api_key_preview}
              </p>
            )}
          </div>

          <Button
            onClick={handleSaveApiKey}
            disabled={saving || !newApiKey.trim()}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : existingKey ? (
              'Update API Key'
            ) : (
              'Add API Key'
            )}
          </Button>
        </div>

        {/* Existing API Keys List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : apiKeys.length > 0 ? (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Your API Keys</Label>
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {PROVIDER_INFO[key.provider].name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {key.api_key_preview}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Added {new Date(key.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteApiKey(key.provider)}
                  disabled={deleting === key.provider}
                  className="text-destructive hover:text-destructive"
                >
                  {deleting === key.provider ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No API keys added yet. Add one above to use your own AI credits.
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col items-start gap-2 text-xs text-muted-foreground border-t pt-4">
        <p>
          <strong>Note:</strong> Your API keys are encrypted and stored securely. They are only used for AI features when you analyze videos.
        </p>
        <p>
          If no API key is set, the server&apos;s default API keys will be used (subject to rate limits).
        </p>
      </CardFooter>
    </Card>
  )
}
