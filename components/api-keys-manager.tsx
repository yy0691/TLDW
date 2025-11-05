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
import type { UserApiKey } from '@/lib/types'

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
  custom: {
    name: 'Custom Provider',
    getKeyUrl: '',
    description: 'Use any OpenAI-compatible API (DeepSeek, Zhipu, Qwen, etc.)',
  },
}

// Common Chinese AI providers
const PRESET_PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { id: 'zhipu', name: 'Zhipu AI (智谱)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4' },
  { id: 'qwen', name: 'Alibaba Qwen (通义千问)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus' },
  { id: 'moonshot', name: 'Moonshot AI (月之暗面)', baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
  { id: 'doubao', name: 'ByteDance Doubao (豆包)', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-pro-32k' },
]

export default function ApiKeysManager() {
  const [apiKeys, setApiKeys] = useState<UserApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  
  const [selectedProvider, setSelectedProvider] = useState<'google' | 'openai' | 'custom'>('google')
  const [newApiKey, setNewApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  
  // Custom provider fields
  const [customProviderName, setCustomProviderName] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string>('')

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
      console.log('Fetched API keys:', data)
      
      // Transform the data to match UserApiKey interface
      const transformedKeys: UserApiKey[] = (data.apiKeys || []).map((key: any) => ({
        id: key.id,
        provider: key.provider,
        providerName: key.provider_name,
        apiKeyPreview: key.api_key_preview,
        baseUrl: key.base_url,
        modelName: key.model_name,
        isActive: key.is_active,
        createdAt: key.created_at,
        updatedAt: key.updated_at,
      }))
      
      setApiKeys(transformedKeys)
    } catch (error) {
      console.error('Error fetching API keys:', error)
      toast.error('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId)
    const preset = PRESET_PROVIDERS.find(p => p.id === presetId)
    if (preset) {
      setCustomProviderName(preset.name)
      setCustomBaseUrl(preset.baseUrl)
      setCustomModel(preset.defaultModel)
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

    // Validate custom provider fields
    if (selectedProvider === 'custom') {
      if (!customProviderName.trim()) {
        toast.error('Please enter a provider name')
        return
      }
      if (!customBaseUrl.trim()) {
        toast.error('Please enter a base URL')
        return
      }
      if (!customModel.trim()) {
        toast.error('Please enter a model name')
        return
      }
    }

    try {
      setSaving(true)
      
      const requestBody: any = {
        provider: selectedProvider === 'custom' ? selectedPreset || 'custom' : selectedProvider,
        apiKey: newApiKey,
      }

      if (selectedProvider === 'custom') {
        requestBody.providerName = customProviderName
        requestBody.baseUrl = customBaseUrl
        requestBody.modelName = customModel
      }
      
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
      
      if (!response.ok) {
        const error = await response.json()
        const errorMessage = error.details 
          ? `${error.error}\n\nDetails: ${error.details}`
          : error.error || 'Failed to save API key'
        throw new Error(errorMessage)
      }
      
      const providerName = selectedProvider === 'custom' ? customProviderName : PROVIDER_INFO[selectedProvider].name
      toast.success(`${providerName} API key saved successfully!`)
      setNewApiKey('')
      setCustomProviderName('')
      setCustomBaseUrl('')
      setCustomModel('')
      setSelectedPreset('')
      fetchApiKeys()
    } catch (error) {
      console.error('Error saving API key:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save API key')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteApiKey = async (provider: string) => {
    const keyToDelete = apiKeys.find(k => k.provider === provider)
    const displayName = keyToDelete?.providerName || keyToDelete?.provider || 'this'
    
    if (!confirm(`Are you sure you want to delete your ${displayName} API key?`)) {
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

  const existingKey = apiKeys.find(key => {
    if (selectedProvider === 'custom') {
      return key.provider === (selectedPreset || 'custom')
    }
    return key.provider === selectedProvider
  })

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
            <Select value={selectedProvider} onValueChange={(v) => {
              setSelectedProvider(v as 'google' | 'openai' | 'custom')
              setSelectedPreset('')
              setCustomProviderName('')
              setCustomBaseUrl('')
              setCustomModel('')
            }}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Gemini</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="custom">Custom Provider (中国大模型)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{PROVIDER_INFO[selectedProvider].description}</span>
              {PROVIDER_INFO[selectedProvider].getKeyUrl && (
                <a
                  href={PROVIDER_INFO[selectedProvider].getKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Get API Key
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Custom Provider Preset Selection */}
          {selectedProvider === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="preset">Select Provider (Optional)</Label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger id="preset">
                  <SelectValue placeholder="Choose a preset or enter custom..." />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_PROVIDERS.map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom Provider Fields */}
          {selectedProvider === 'custom' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="providerName">Provider Name</Label>
                <Input
                  id="providerName"
                  type="text"
                  value={customProviderName}
                  onChange={(e) => setCustomProviderName(e.target.value)}
                  placeholder="e.g., DeepSeek, Zhipu AI"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  type="text"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="e.g., https://api.deepseek.com/v1"
                />
                <p className="text-xs text-muted-foreground">
                  OpenAI-compatible API endpoint
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="modelName">Model Name</Label>
                <Input
                  id="modelName"
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="e.g., deepseek-chat, glm-4"
                />
              </div>
            </>
          )}

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
                Current key: {existingKey.apiKeyPreview}
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
            {apiKeys.map((key) => {
              const displayName = key.providerName || 
                                 (PROVIDER_INFO[key.provider as keyof typeof PROVIDER_INFO]?.name) || 
                                 key.provider
              return (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {displayName}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {key.apiKeyPreview}
                    </div>
                    {key.baseUrl && (
                      <div className="text-xs text-muted-foreground">
                        URL: {key.baseUrl}
                      </div>
                    )}
                    {key.modelName && (
                      <div className="text-xs text-muted-foreground">
                        Model: {key.modelName}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Added {new Date(key.createdAt).toLocaleDateString()}
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
              )
            })}
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
        <p>
          <strong>Custom Providers:</strong> Supports any OpenAI-compatible API. Popular Chinese providers include DeepSeek, Zhipu AI, Alibaba Qwen, Moonshot, and ByteDance Doubao.
        </p>
      </CardFooter>
    </Card>
  )
}
